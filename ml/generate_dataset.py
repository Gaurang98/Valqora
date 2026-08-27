"""
Valqora Synthetic Dataset Generator
AI Revenue Decision & Recovery Engine

Generates deterministic, realistic enterprise synthetic datasets for:
1. customers.csv     - Customer historical profiles and lifetime value
2. transactions.csv  - Exactly 100,000 transactions with logical ground-truth labels
3. events.csv        - Real-time audit events, checkout abandonments, and provider degradation incidents

Usage:
    python ml/generate_dataset.py
"""

import os
import sys
import json
import random
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from faker import Faker

# Ensure UTF-8 output on Windows consoles
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


# Fixed seed for complete determinism & reproducibility
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
Faker.seed(RANDOM_SEED)
fake = Faker('en_IN')

# Configuration
NUM_CUSTOMERS = 25000
NUM_TRANSACTIONS = 100000
START_DATE = datetime(2026, 6, 28, 0, 0, 0)
END_DATE = datetime(2026, 8, 26, 23, 59, 59)
TOTAL_SECONDS = int((END_DATE - START_DATE).total_seconds())

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

PROVIDERS = ['Provider_A', 'Provider_B', 'Provider_C', 'Provider_D']
PAYMENT_METHODS = ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET']

# Provider degradation windows (for realistic incident telemetry)
DEGRADATION_INCIDENTS = [
    {
        'provider': 'Provider_A',
        'start': datetime(2026, 8, 25, 14, 0, 0),
        'end': datetime(2026, 8, 25, 18, 30, 0),
        'failure_multiplier': 5.5,
        'reason': 'PROVIDER_TIMEOUT',
        'severity': 'CRITICAL',
        'detail': 'Upstream Banking Switch Gateway 504 Timeout Surge'
    },
    {
        'provider': 'Provider_A',
        'start': datetime(2026, 8, 12, 9, 30, 0),
        'end': datetime(2026, 8, 12, 13, 0, 0),
        'failure_multiplier': 4.0,
        'reason': 'NETWORK_ERROR',
        'severity': 'ERROR',
        'detail': 'Acquirer Socket Connection Drop on HDFC/SBI Netbanking'
    },
    {
        'provider': 'Provider_C',
        'start': datetime(2026, 7, 20, 16, 0, 0),
        'end': datetime(2026, 7, 20, 19, 0, 0),
        'failure_multiplier': 3.5,
        'reason': 'BANK_TIMEOUT',
        'severity': 'WARNING',
        'detail': 'UPI Mandate Validation Queue Overflow'
    }
]


def is_in_degradation_window(timestamp: datetime, provider: str):
    """Check if a timestamp and provider falls inside an active degradation incident."""
    for inc in DEGRADATION_INCIDENTS:
        if inc['provider'] == provider and inc['start'] <= timestamp <= inc['end']:
            return inc
    return None


def generate_customers(num_customers: int) -> pd.DataFrame:
    """Generate realistic customer baseline profiles."""
    print(f"Generating {num_customers:,} unique customer profiles...")
    
    customer_ids = [f"CUST_{i+1:05d}" for i in range(num_customers)]
    
    # Customer type distribution: NEW (25%), REGULAR (60%), HIGH_VALUE (15%)
    customer_types = np.random.choice(
        ['NEW', 'REGULAR', 'HIGH_VALUE'], 
        size=num_customers, 
        p=[0.25, 0.60, 0.15]
    )
    
    records = []
    for cid, ctype in zip(customer_ids, customer_types):
        if ctype == 'NEW':
            purchase_count = random.randint(1, 3)
            avg_order_value = round(float(np.random.gamma(shape=3.0, scale=400.0) + 300), 2)
            avg_order_value = min(max(avg_order_value, 250.0), 4500.0)
            total_spent = round(purchase_count * avg_order_value, 2)
            previous_failures = int(np.random.choice([0, 1, 2], p=[0.85, 0.12, 0.03]))
            successful_transactions = purchase_count
            clv = round(total_spent * random.uniform(1.5, 3.0), 2)
            days_ago = random.randint(1, 20)
        elif ctype == 'REGULAR':
            purchase_count = random.randint(4, 25)
            avg_order_value = round(float(np.random.gamma(shape=4.0, scale=750.0) + 500), 2)
            avg_order_value = min(max(avg_order_value, 600.0), 12000.0)
            total_spent = round(purchase_count * avg_order_value, 2)
            previous_failures = int(np.random.choice([0, 1, 2, 3, 4], p=[0.60, 0.25, 0.10, 0.04, 0.01]))
            successful_transactions = purchase_count
            clv = round(total_spent * random.uniform(2.0, 4.5), 2)
            days_ago = random.randint(1, 55)
        else:  # HIGH_VALUE
            purchase_count = random.randint(20, 120)
            avg_order_value = round(float(np.random.gamma(shape=5.0, scale=2500.0) + 3500), 2)
            avg_order_value = min(max(avg_order_value, 4000.0), 65000.0)
            total_spent = round(purchase_count * avg_order_value, 2)
            previous_failures = int(np.random.choice([0, 1, 2, 3, 5], p=[0.50, 0.28, 0.14, 0.06, 0.02]))
            successful_transactions = purchase_count
            clv = round(total_spent * random.uniform(2.5, 5.5), 2)
            days_ago = random.randint(0, 30)

        last_purchase_date = (END_DATE - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))).strftime('%Y-%m-%d %H:%M:%S')

        records.append({
            'customer_id': cid,
            'customer_type': ctype,
            'total_spent': total_spent,
            'purchase_count': purchase_count,
            'average_order_value': avg_order_value,
            'previous_failures': previous_failures,
            'successful_transactions': successful_transactions,
            'last_purchase_date': last_purchase_date,
            'customer_lifetime_value': clv
        })

    df = pd.DataFrame(records)
    return df


def generate_transactions(num_transactions: int, customers_df: pd.DataFrame) -> pd.DataFrame:
    """Generate exactly 100,000 transactions with logical ground-truth recovery labels."""
    print(f"Generating exactly {num_transactions:,} transactions...")

    # Probability weighting for customer sampling based on customer_type
    weights = []
    cust_dict = {}
    for row in customers_df.itertuples(index=False):
        cust_dict[row.customer_id] = row
        if row.customer_type == 'HIGH_VALUE':
            weights.append(5.0)
        elif row.customer_type == 'REGULAR':
            weights.append(2.0)
        else:
            weights.append(1.0)
    
    weights = np.array(weights) / sum(weights)
    all_customer_ids = customers_df['customer_id'].values

    # Sample customer IDs for all 100,000 transactions
    sampled_cids = np.random.choice(all_customer_ids, size=num_transactions, p=weights)

    # Generate random timestamps across the 60-day window
    random_offsets = np.random.randint(0, TOTAL_SECONDS, size=num_transactions)
    random_offsets.sort()  # Sort timestamps chronologically

    # Payment method distribution in Indian market: UPI 45%, Credit 25%, Debit 15%, Net Banking 10%, Wallet 5%
    payment_methods = np.random.choice(
        PAYMENT_METHODS,
        size=num_transactions,
        p=[0.45, 0.25, 0.15, 0.10, 0.05]
    )

    # Provider distribution: Provider_A 35%, Provider_B 30%, Provider_C 20%, Provider_D 15%
    providers = np.random.choice(
        PROVIDERS,
        size=num_transactions,
        p=[0.35, 0.30, 0.20, 0.15]
    )

    transactions = []
    
    for i in range(num_transactions):
        txn_id = f"TXN_{i+1:06d}"
        cid = sampled_cids[i]
        cust = cust_dict[cid]
        timestamp = START_DATE + timedelta(seconds=int(random_offsets[i]))
        pm = payment_methods[i]
        provider = providers[i]
        
        # Calculate realistic transaction amount based on customer AOV and type
        if cust.customer_type == 'NEW':
            amount = round(float(np.random.normal(loc=cust.average_order_value, scale=cust.average_order_value * 0.25)), 2)
            amount = min(max(amount, 99.0), 8500.0)
        elif cust.customer_type == 'REGULAR':
            amount = round(float(np.random.normal(loc=cust.average_order_value, scale=cust.average_order_value * 0.30)), 2)
            amount = min(max(amount, 199.0), 28000.0)
        else:  # HIGH_VALUE
            amount = round(float(np.random.normal(loc=cust.average_order_value, scale=cust.average_order_value * 0.35)), 2)
            amount = min(max(amount, 1200.0), 125000.0)

        # Base failure rate is ~6.8% (achieving ~92-93% overall success rate)
        base_failure_prob = 0.068
        
        # Check if transaction falls in a provider degradation window
        degrade_inc = is_in_degradation_window(timestamp, provider)
        if degrade_inc:
            failure_prob = min(base_failure_prob * degrade_inc['failure_multiplier'], 0.42)
        else:
            failure_prob = base_failure_prob
            # Payment method specific failure slight adjustments
            if pm == 'NET_BANKING':
                failure_prob += 0.015
            elif pm == 'UPI':
                failure_prob -= 0.005

        is_failed = random.random() < failure_prob
        
        if not is_failed:
            status = 'SUCCESS'
            failure_reason = 'NONE'
            retry_count = 0
            is_recoverable = 'NO'
            ground_truth_action = 'NO_ACTION'
            ground_truth_priority = 'NONE'
        else:
            status = 'FAILED'
            
            # Select realistic failure reason
            if degrade_inc and random.random() < 0.75:
                failure_reason = degrade_inc['reason']
            else:
                # Distribution of failures
                # Temporary: BANK_TIMEOUT, NETWORK_ERROR, PROVIDER_TIMEOUT
                # Permanent/Customer: CARD_EXPIRED, INSUFFICIENT_FUNDS, INVALID_CARD, PAYMENT_METHOD_EXPIRED, RECURRING_PAYMENT_FAILED
                # Risk: SUSPICIOUS_TRANSACTION
                if pm in ['CREDIT_CARD', 'DEBIT_CARD']:
                    reasons = [
                        'BANK_TIMEOUT', 'PROVIDER_TIMEOUT', 'NETWORK_ERROR',
                        'CARD_EXPIRED', 'INSUFFICIENT_FUNDS', 'INVALID_CARD',
                        'PAYMENT_METHOD_EXPIRED', 'RECURRING_PAYMENT_FAILED',
                        'SUSPICIOUS_TRANSACTION'
                    ]
                    weights = [0.22, 0.18, 0.10, 0.12, 0.15, 0.08, 0.06, 0.06, 0.03]
                elif pm == 'UPI':
                    reasons = [
                        'BANK_TIMEOUT', 'PROVIDER_TIMEOUT', 'NETWORK_ERROR',
                        'INSUFFICIENT_FUNDS', 'PAYMENT_METHOD_EXPIRED', 'RECURRING_PAYMENT_FAILED',
                        'SUSPICIOUS_TRANSACTION'
                    ]
                    weights = [0.30, 0.24, 0.16, 0.14, 0.06, 0.07, 0.03]
                else:  # NET_BANKING, WALLET
                    reasons = [
                        'BANK_TIMEOUT', 'PROVIDER_TIMEOUT', 'NETWORK_ERROR',
                        'INSUFFICIENT_FUNDS', 'PAYMENT_METHOD_EXPIRED',
                        'SUSPICIOUS_TRANSACTION'
                    ]
                    weights = [0.35, 0.28, 0.15, 0.12, 0.07, 0.03]
                
                failure_reason = random.choices(reasons, weights=weights)[0]

            # Realistic retry count
            # Most failed transactions have 0 retries (initial failure), some have 1, 2, or 3+
            if failure_reason == 'SUSPICIOUS_TRANSACTION':
                retry_count = 0
            else:
                retry_count = int(np.random.choice([0, 1, 2, 3, 4], p=[0.68, 0.18, 0.08, 0.04, 0.02]))

            # Logical derivation of is_recoverable and ground_truth_action
            if failure_reason == 'SUSPICIOUS_TRANSACTION':
                is_recoverable = 'NO'
                ground_truth_action = 'HUMAN_REVIEW'
                ground_truth_priority = 'CRITICAL'

            elif failure_reason in ['BANK_TIMEOUT', 'PROVIDER_TIMEOUT', 'NETWORK_ERROR']:
                if retry_count <= 1:
                    is_recoverable = 'YES'
                    ground_truth_action = 'RETRY'
                elif retry_count == 2:
                    is_recoverable = 'POSSIBLY'
                    ground_truth_action = 'PAYMENT_LINK' if cust.customer_type in ['HIGH_VALUE', 'REGULAR'] else 'RETRY'
                else:  # retry_count >= 3
                    is_recoverable = 'NO'
                    ground_truth_action = 'PAYMENT_LINK' if cust.customer_type == 'HIGH_VALUE' else 'WAIT'

            elif failure_reason in ['CARD_EXPIRED', 'PAYMENT_METHOD_EXPIRED', 'INVALID_CARD']:
                is_recoverable = 'POSSIBLY'
                ground_truth_action = 'PAYMENT_METHOD_UPDATE'

            elif failure_reason == 'RECURRING_PAYMENT_FAILED':
                if cust.customer_type == 'HIGH_VALUE' and cust.previous_failures <= 1:
                    is_recoverable = 'YES'
                    ground_truth_action = 'PAYMENT_LINK'
                else:
                    is_recoverable = 'POSSIBLY'
                    ground_truth_action = 'PAYMENT_METHOD_UPDATE'

            elif failure_reason == 'INSUFFICIENT_FUNDS':
                is_recoverable = 'POSSIBLY'
                # Check if near end of month (28-31) or start of month (1-5) -> payday timing
                day = timestamp.day
                if day >= 28 or day <= 5:
                    ground_truth_action = 'WAIT'
                else:
                    ground_truth_action = 'PAYMENT_LINK'

            else:
                is_recoverable = 'POSSIBLY'
                ground_truth_action = 'PAYMENT_LINK'

            # Determine ground_truth_priority for non-suspicious failures
            if failure_reason != 'SUSPICIOUS_TRANSACTION':
                if cust.customer_type == 'HIGH_VALUE' and (amount >= 25000.0 or cust.customer_lifetime_value >= 150000.0):
                    ground_truth_priority = 'CRITICAL' if amount >= 60000.0 else 'HIGH'
                elif is_recoverable == 'YES' and (amount >= 8000.0 or cust.customer_type == 'HIGH_VALUE'):
                    ground_truth_priority = 'HIGH'
                elif is_recoverable == 'YES' or (cust.customer_type == 'REGULAR' and amount >= 3000.0):
                    ground_truth_priority = 'MEDIUM'
                elif is_recoverable == 'POSSIBLY' and amount >= 5000.0:
                    ground_truth_priority = 'MEDIUM'
                elif cust.previous_failures >= 3 or amount < 1000.0:
                    ground_truth_priority = 'LOW'
                else:
                    ground_truth_priority = 'LOW'

        transactions.append({
            'transaction_id': txn_id,
            'customer_id': cid,
            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'amount': amount,
            'currency': 'INR',
            'payment_method': pm,
            'provider': provider,
            'status': status,
            'failure_reason': failure_reason,
            'retry_count': retry_count,
            'customer_type': cust.customer_type,
            'customer_lifetime_value': cust.customer_lifetime_value,
            'previous_failures': cust.previous_failures,
            'is_recoverable': is_recoverable,
            'ground_truth_action': ground_truth_action,
            'ground_truth_priority': ground_truth_priority
        })

    df = pd.DataFrame(transactions)
    return df


def generate_events(transactions_df: pd.DataFrame, customers_df: pd.DataFrame) -> pd.DataFrame:
    """Generate realistic lifecycle events, checkout abandonments, and provider degradation incidents."""
    print("Generating related audit, recovery, and degradation events...")

    events = []
    event_counter = 1
    
    # 1. Events for Failed Transactions (PAYMENT_FAILED, PAYMENT_RETRY, PAYMENT_RECOVERED, POLICY_BLOCKED)
    failed_txns = transactions_df[transactions_df['status'] == 'FAILED']
    
    for row in failed_txns.itertuples(index=False):
        txn_time = datetime.strptime(row.timestamp, '%Y-%m-%d %H:%M:%S')
        
        # Initial failure event
        meta_failed = {
            'failure_reason': row.failure_reason,
            'amount': row.amount,
            'payment_method': row.payment_method,
            'retry_count': row.retry_count,
            'is_recoverable': row.is_recoverable,
            'recommended_action': row.ground_truth_action
        }
        
        severity = 'CRITICAL' if row.ground_truth_priority == 'CRITICAL' else ('ERROR' if row.ground_truth_priority == 'HIGH' else 'WARNING')

        events.append({
            'event_id': f"EVT_{event_counter:07d}",
            'timestamp': row.timestamp,
            'event_type': 'PAYMENT_FAILED',
            'transaction_id': row.transaction_id,
            'customer_id': row.customer_id,
            'provider': row.provider,
            'severity': severity,
            'metadata': json.dumps(meta_failed)
        })
        event_counter += 1

        # If retried, generate retry events
        if row.retry_count > 0:
            for r in range(1, row.retry_count + 1):
                retry_time = txn_time + timedelta(minutes=r * random.randint(3, 15))
                meta_retry = {
                    'attempt_number': r,
                    'max_allowed_attempts': 3,
                    'strategy': 'EXPONENTIAL_BACKOFF',
                    'original_failure': row.failure_reason
                }
                events.append({
                    'event_id': f"EVT_{event_counter:07d}",
                    'timestamp': retry_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'event_type': 'PAYMENT_RETRY',
                    'transaction_id': row.transaction_id,
                    'customer_id': row.customer_id,
                    'provider': row.provider,
                    'severity': 'INFO',
                    'metadata': json.dumps(meta_retry)
                })
                event_counter += 1

            # If retry count >= 3, policy blocked event
            if row.retry_count >= 3:
                blocked_time = txn_time + timedelta(minutes=(row.retry_count + 1) * 5)
                meta_blocked = {
                    'policy_rule': 'POL_MAX_RETRIES_EXCEEDED',
                    'retry_attempts_exhausted': row.retry_count,
                    'action': 'HALT_AUTOMATIC_RETRY',
                    'suggested_fallback': row.ground_truth_action
                }
                events.append({
                    'event_id': f"EVT_{event_counter:07d}",
                    'timestamp': blocked_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'event_type': 'POLICY_BLOCKED',
                    'transaction_id': row.transaction_id,
                    'customer_id': row.customer_id,
                    'provider': row.provider,
                    'severity': 'WARNING',
                    'metadata': json.dumps(meta_blocked)
                })
                event_counter += 1

        # Simulate realistic downstream recovery for ~65% of recoverable items
        if row.is_recoverable == 'YES' and row.retry_count <= 2 and random.random() < 0.65:
            recov_time = txn_time + timedelta(minutes=random.randint(10, 180))
            meta_recovered = {
                'recovered_amount': row.amount,
                'recovery_channel': 'AUTONOMOUS_SMART_RETRY' if row.ground_truth_action == 'RETRY' else 'PAYMENT_LINK_DISPATCH',
                'time_to_recover_minutes': int((recov_time - txn_time).total_seconds() / 60),
                'settlement_status': 'CONFIRMED'
            }
            events.append({
                'event_id': f"EVT_{event_counter:07d}",
                'timestamp': recov_time.strftime('%Y-%m-%d %H:%M:%S'),
                'event_type': 'PAYMENT_RECOVERED',
                'transaction_id': row.transaction_id,
                'customer_id': row.customer_id,
                'provider': row.provider,
                'severity': 'INFO',
                'metadata': json.dumps(meta_recovered)
            })
            event_counter += 1

    # 2. Checkout Abandonment Events (~4,000 realistic checkout drop-offs)
    print("Generating checkout abandonment events...")
    all_cids = customers_df['customer_id'].values
    num_abandonments = 4200
    
    abandon_offsets = np.random.randint(0, TOTAL_SECONDS, size=num_abandonments)
    abandon_cids = np.random.choice(all_cids, size=num_abandonments)
    abandon_steps = ['PAYMENT_METHOD_SELECTION', 'OTP_INPUT_SCREEN', 'MANDATE_AUTHORIZATION', 'CARD_CVV_STEP', 'CART_REVIEW']
    
    for i in range(num_abandonments):
        ab_time = START_DATE + timedelta(seconds=int(abandon_offsets[i]))
        ab_cid = abandon_cids[i]
        ab_provider = random.choice(PROVIDERS)
        ab_amount = round(float(np.random.gamma(shape=3.5, scale=600.0) + 400.0), 2)
        ab_step = random.choice(abandon_steps)
        
        meta_abandon = {
            'abandoned_step': ab_step,
            'cart_value': ab_amount,
            'device_type': random.choice(['MOBILE_APP', 'MOBILE_WEB', 'DESKTOP_WEB']),
            'intent_score': round(random.uniform(0.40, 0.95), 2),
            'recovery_channel_suggested': 'WHATSAPP_SAVED_CART_LINK'
        }
        
        events.append({
            'event_id': f"EVT_{event_counter:07d}",
            'timestamp': ab_time.strftime('%Y-%m-%d %H:%M:%S'),
            'event_type': 'CHECKOUT_ABANDONED',
            'transaction_id': '',  # No transaction ID since payment wasn't submitted
            'customer_id': ab_cid,
            'provider': ab_provider,
            'severity': 'WARNING',
            'metadata': json.dumps(meta_abandon)
        })
        event_counter += 1

    # 3. Provider Degradation Telemetry Events
    print("Generating provider degradation incident telemetry logs...")
    for inc in DEGRADATION_INCIDENTS:
        # Generate periodic heartbeats/alerts during incident
        curr_time = inc['start']
        while curr_time <= inc['end']:
            latency = random.randint(8500, 18500)
            error_rate = round(random.uniform(28.0, 48.5), 1)
            
            meta_deg = {
                'incident_reason': inc['reason'],
                'detail': inc['detail'],
                'p99_latency_ms': latency,
                'error_rate_pct': error_rate,
                'affected_routes': ['HDFC_NETBANKING', 'SBI_UPI_SWITCH', 'ICICI_CARDS'],
                'recommended_switch': 'Provider_B'
            }
            
            events.append({
                'event_id': f"EVT_{event_counter:07d}",
                'timestamp': curr_time.strftime('%Y-%m-%d %H:%M:%S'),
                'event_type': 'PROVIDER_DEGRADATION',
                'transaction_id': '',
                'customer_id': 'SYSTEM_TELEMETRY',
                'provider': inc['provider'],
                'severity': inc['severity'],
                'metadata': json.dumps(meta_deg)
            })
            event_counter += 1
            curr_time += timedelta(minutes=15)

    df = pd.DataFrame(events)
    # Sort chronologically by timestamp
    df = df.sort_values(by='timestamp').reset_index(drop=True)
    # Re-assign sequential event IDs after sorting
    df['event_id'] = [f"EVT_{i+1:07d}" for i in range(len(df))]
    return df


def validate_datasets(customers_df: pd.DataFrame, transactions_df: pd.DataFrame, events_df: pd.DataFrame):
    """Run strict integrity and schema validation checks."""
    print("\nRunning comprehensive dataset validation checks...")

    # 1. Transaction count check
    assert len(transactions_df) == 100000, f"Validation Error: Expected 100,000 transactions, got {len(transactions_df)}"
    print("[OK] Exactly 100,000 transactions generated.")

    # 2. Duplicate ID checks
    assert transactions_df['transaction_id'].nunique() == len(transactions_df), "Validation Error: Duplicate transaction IDs found!"
    assert customers_df['customer_id'].nunique() == len(customers_df), "Validation Error: Duplicate customer IDs found!"
    assert events_df['event_id'].nunique() == len(events_df), "Validation Error: Duplicate event IDs found!"
    print("[OK] All IDs are globally unique with 0 collisions.")

    # 3. Foreign Key / Reference integrity
    valid_cids = set(customers_df['customer_id'])
    valid_cids.add('SYSTEM_TELEMETRY')
    
    invalid_txn_cust = set(transactions_df['customer_id']) - valid_cids
    assert len(invalid_txn_cust) == 0, f"Validation Error: Transactions reference non-existent customers: {invalid_txn_cust}"
    
    invalid_evt_cust = set(events_df['customer_id']) - valid_cids
    assert len(invalid_evt_cust) == 0, f"Validation Error: Events reference non-existent customers: {invalid_evt_cust}"
    
    valid_txns = set(transactions_df['transaction_id'])
    valid_txns.add('')  # For standalone events like abandonments or provider incidents
    invalid_evt_txns = set(events_df['transaction_id']) - valid_txns
    assert len(invalid_evt_txns) == 0, f"Validation Error: Events reference non-existent transactions: {invalid_evt_txns}"
    print("[OK] Relational integrity between Customers, Transactions, and Events validated.")

    # 4. Null value checks
    required_txn_cols = [
        'transaction_id', 'customer_id', 'timestamp', 'amount', 'currency',
        'payment_method', 'provider', 'status', 'failure_reason', 'retry_count',
        'customer_type', 'customer_lifetime_value', 'previous_failures',
        'is_recoverable', 'ground_truth_action', 'ground_truth_priority'
    ]
    for col in required_txn_cols:
        assert transactions_df[col].isnull().sum() == 0, f"Validation Error: Column '{col}' contains unexpected nulls!"

    # 5. Success rate bounds
    success_rate = (transactions_df['status'] == 'SUCCESS').mean() * 100
    assert 88.0 <= success_rate <= 95.0, f"Validation Error: Success rate {success_rate:.2f}% outside realistic 88-95% range!"
    print(f"[OK] Realistic success rate validated ({success_rate:.2f}%).")

    # 6. Logical label rules consistency
    successes = transactions_df[transactions_df['status'] == 'SUCCESS']
    assert (successes['failure_reason'] == 'NONE').all(), "Validation Error: Successful txns must have failure_reason == NONE!"
    assert (successes['is_recoverable'] == 'NO').all(), "Validation Error: Successful txns must have is_recoverable == NO!"
    assert (successes['ground_truth_action'] == 'NO_ACTION').all(), "Validation Error: Successful txns must have ground_truth_action == NO_ACTION!"

    suspicious = transactions_df[transactions_df['failure_reason'] == 'SUSPICIOUS_TRANSACTION']
    assert (suspicious['is_recoverable'] == 'NO').all(), "Validation Error: Suspicious txns must have is_recoverable == NO!"
    assert (suspicious['ground_truth_action'] == 'HUMAN_REVIEW').all(), "Validation Error: Suspicious txns must have ground_truth_action == HUMAN_REVIEW!"
    assert (suspicious['ground_truth_priority'] == 'CRITICAL').all(), "Validation Error: Suspicious txns must have ground_truth_priority == CRITICAL!"

    print("[OK] All business rules and ground-truth logic verified.")
    print("[OK] All validation checks passed successfully!")


def print_summary(customers_df: pd.DataFrame, transactions_df: pd.DataFrame, events_df: pd.DataFrame):
    """Print comprehensive statistical summary of the generated dataset."""
    total_txns = len(transactions_df)
    success_count = (transactions_df['status'] == 'SUCCESS').sum()
    failure_count = (transactions_df['status'] == 'FAILED').sum()
    success_rate = (success_count / total_txns) * 100
    failure_rate = (failure_count / total_txns) * 100

    recoverable_count = (transactions_df['is_recoverable'] == 'YES').sum()
    possibly_count = (transactions_df['is_recoverable'] == 'POSSIBLY').sum()
    non_recoverable_count = (transactions_df['is_recoverable'] == 'NO').sum()

    total_amount = transactions_df['amount'].sum()
    failed_amount = transactions_df[transactions_df['status'] == 'FAILED']['amount'].sum()

    print("\n" + "=" * 65)
    print("           VALQORA SYNTHETIC DATASET SUMMARY")
    print("=" * 65)
    print(f"Number of customers:              {len(customers_df):,}")
    print(f"Number of transactions:           {total_txns:,}")
    print(f"Number of events:                 {len(events_df):,}")
    print("-" * 65)
    print(f"Total transaction volume:         INR {total_amount:,.2f}")
    print(f"Total failed volume (At Risk):    INR {failed_amount:,.2f} ({(failed_amount/total_amount)*100:.2f}%)")
    print("-" * 65)
    print(f"Successful transactions:          {success_count:,} ({success_rate:.2f}%)")
    print(f"Failed transactions:              {failure_count:,} ({failure_rate:.2f}%)")
    print("-" * 65)
    print("Recoverability Distribution (All Transactions):")
    print(f"  - YES (High Confidence):        {recoverable_count:,} ({(recoverable_count/total_txns)*100:.2f}%)")
    print(f"  - POSSIBLY (Action Needed):     {possibly_count:,} ({(possibly_count/total_txns)*100:.2f}%)")
    print(f"  - NO (Non-recoverable/Success): {non_recoverable_count:,} ({(non_recoverable_count/total_txns)*100:.2f}%)")
    print("-" * 65)
    print("Distribution of Failure Reasons (Failed Transactions Only):")
    fail_counts = transactions_df[transactions_df['status'] == 'FAILED']['failure_reason'].value_counts()
    for reason, count in fail_counts.items():
        pct = (count / failure_count) * 100
        print(f"  - {reason:<28}: {count:>5,} ({pct:>5.1f}%)")
    print("-" * 65)
    print("Distribution of Ground Truth Actions:")
    action_counts = transactions_df['ground_truth_action'].value_counts()
    for action, count in action_counts.items():
        pct = (count / total_txns) * 100
        print(f"  - {action:<28}: {count:>6,} ({pct:>5.1f}%)")
    print("-" * 65)
    print("Distribution of Priority Levels (Failed Transactions):")
    priority_counts = transactions_df[transactions_df['status'] == 'FAILED']['ground_truth_priority'].value_counts()
    for prio, count in priority_counts.items():
        pct = (count / failure_count) * 100
        print(f"  - {prio:<28}: {count:>5,} ({pct:>5.1f}%)")
    print("=" * 65 + "\n")


def main():
    print("=" * 65)
    print("  Valqora AI Revenue Decision & Recovery Engine")
    print("  Synthetic Dataset Generation (Deterministic Seed = 42)")
    print("=" * 65)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. Generate Customers
    customers_df = generate_customers(NUM_CUSTOMERS)
    customers_path = os.path.join(OUTPUT_DIR, 'customers.csv')
    customers_df.to_csv(customers_path, index=False)
    print(f"Saved: {customers_path}")

    # 2. Generate Transactions
    transactions_df = generate_transactions(NUM_TRANSACTIONS, customers_df)
    transactions_path = os.path.join(OUTPUT_DIR, 'transactions.csv')
    transactions_df.to_csv(transactions_path, index=False)
    print(f"Saved: {transactions_path}")

    # 3. Generate Events
    events_df = generate_events(transactions_df, customers_df)
    events_path = os.path.join(OUTPUT_DIR, 'events.csv')
    events_df.to_csv(events_path, index=False)
    print(f"Saved: {events_path}")

    # 4. Validate
    validate_datasets(customers_df, transactions_df, events_df)

    # 5. Print Summary
    print_summary(customers_df, transactions_df, events_df)


if __name__ == '__main__':
    main()
