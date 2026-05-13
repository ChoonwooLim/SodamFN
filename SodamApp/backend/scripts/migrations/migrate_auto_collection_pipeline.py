"""Auto-collection pipeline DB migration (idempotent ALTER/CREATE).

Run: python scripts/migrations/migrate_auto_collection_pipeline.py
"""
from sqlalchemy import text
from database import engine

DDL_STATEMENTS = [
    # 1) DailyExpense.source
    """ALTER TABLE dailyexpense
       ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'manual',
       ADD COLUMN IF NOT EXISTS source_meta TEXT""",
    "CREATE INDEX IF NOT EXISTS ix_dailyexpense_source ON dailyexpense (source)",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_dailyexpense_natural
       ON dailyexpense (business_id, date, vendor_id, payment_method, source)""",

    # 2) CardFeeRateLearned
    """CREATE TABLE IF NOT EXISTS cardfeeratelearned (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        card_corp VARCHAR(32) NOT NULL,
        learned_rate FLOAT NOT NULL,
        sample_size INTEGER NOT NULL,
        sample_period_start DATE NOT NULL,
        sample_period_end DATE NOT NULL,
        confidence FLOAT NOT NULL,
        last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT,
        UNIQUE (business_id, card_corp)
    )""",

    # 3) CardFeeMatchLog
    """CREATE TABLE IF NOT EXISTS cardfeematchlog (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        card_corp VARCHAR(32) NOT NULL,
        deposit_date DATE NOT NULL,
        approval_dates_start DATE NOT NULL,
        approval_dates_end DATE NOT NULL,
        sales_amount BIGINT NOT NULL,
        deposit_amount BIGINT NOT NULL,
        effective_fee BIGINT NOT NULL,
        effective_rate FLOAT NOT NULL,
        matched_at TIMESTAMP NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_cardfeematchlog_biz_corp ON cardfeematchlog (business_id, card_corp)",

    # 4) CoupangEatsSettlement 분해 컬럼
    """ALTER TABLE coupangeatssettlement
       ADD COLUMN IF NOT EXISTS total_sales BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_brokerage BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_payment BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_delivery BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_advertising BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_membership BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_other BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS deduction_etc BIGINT NOT NULL DEFAULT 0""",

    # 5) SubscriptionPlan 플래그
    """ALTER TABLE subscriptionplan
       ADD COLUMN IF NOT EXISTS feature_auto_collection BOOLEAN NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS feature_fee_auto_estimate BOOLEAN NOT NULL DEFAULT FALSE""",

    # 6) DeliveryFeeRate
    """CREATE TABLE IF NOT EXISTS deliveryfeerate (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        channel VARCHAR(32) NOT NULL,
        rate FLOAT NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        notes TEXT,
        updated_by INTEGER REFERENCES "user"(id),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (business_id, channel, effective_from)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_deliveryfeerate_biz_channel ON deliveryfeerate (business_id, channel)",

    # 7) SettlementWatchAlert
    """CREATE TABLE IF NOT EXISTS settlementwatchalert (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        alert_type VARCHAR(32) NOT NULL,
        channel_or_corp VARCHAR(32) NOT NULL,
        expected_date DATE NOT NULL,
        expected_amount BIGINT NOT NULL,
        deadline DATE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        notified_at TIMESTAMP,
        received_amount BIGINT,
        received_date DATE,
        acknowledged_at TIMESTAMP,
        acknowledged_by INTEGER REFERENCES "user"(id),
        notes TEXT,
        raw_ref TEXT,
        UNIQUE (business_id, alert_type, channel_or_corp, expected_date)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_settle_watch_biz_status ON settlementwatchalert (business_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_settle_watch_alert_type ON settlementwatchalert (alert_type)",

    # 8) CardCorpSettlementProfile
    """CREATE TABLE IF NOT EXISTS cardcorpsettlementprofile (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        card_corp VARCHAR(32) NOT NULL,
        settlement_days_learned INTEGER NOT NULL DEFAULT 3,
        grace_days INTEGER NOT NULL DEFAULT 3,
        sample_size INTEGER NOT NULL DEFAULT 0,
        last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (business_id, card_corp)
    )""",
]


def run():
    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            print(f"-- Executing: {stmt[:80]}...")
            conn.execute(text(stmt))
    print("✅ Auto-collection pipeline migration complete.")


if __name__ == "__main__":
    run()
