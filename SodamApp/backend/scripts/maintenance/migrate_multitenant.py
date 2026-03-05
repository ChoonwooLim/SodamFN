"""
Multi-tenant migration script:
1. Creates new tables (SubscriptionPlan, Business)
2. Adds business_id columns to existing tables
3. Seeds default business + default subscription plans
4. Assigns existing data to the default business
"""
from sqlmodel import Session, select, text
from database import engine, create_db_and_tables
from models import Business, SubscriptionPlan, User, Staff, Vendor, Revenue, Announcement
from datetime import date

def run_migration():
    print("=" * 60)
    print("  Multi-Tenant Migration")
    print("=" * 60)
    
    # 1. Create new tables (SQLModel auto-creates if not exist)
    print("\n[1/5] Creating new tables...")
    create_db_and_tables()
    print("  OK: subscriptionplan, business tables created")
    
    # 2. Add business_id columns to existing tables (idempotent)
    print("\n[2/5] Adding business_id columns...")
    tables_to_update = [
        "vendor", "staff", "revenue", "companyholiday",
        "announcement", "user"
    ]
    
    with Session(engine) as s:
        for table in tables_to_update:
            try:
                s.exec(text(f"ALTER TABLE \"{table}\" ADD COLUMN business_id INTEGER REFERENCES business(id)"))
                print(f"  + {table}.business_id added")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"  ~ {table}.business_id already exists (skip)")
                else:
                    print(f"  ! {table}: {e}")
                s.rollback()
                continue
        
        # Add is_global to announcement
        try:
            s.exec(text('ALTER TABLE "announcement" ADD COLUMN is_global BOOLEAN DEFAULT FALSE'))
            print("  + announcement.is_global added")
        except Exception:
            print("  ~ announcement.is_global already exists (skip)")
            s.rollback()
        
        s.commit()
    
    # 3. Seed default data
    print("\n[3/5] Seeding default subscription plans...")
    with Session(engine) as s:
        existing_plans = s.exec(select(SubscriptionPlan)).all()
        if not existing_plans:
            plans = [
                SubscriptionPlan(name="Free", price_monthly=0, price_yearly=0, max_staff=3, max_revenue_entries=100,
                                 features_json='["payroll","attendance"]'),
                SubscriptionPlan(name="Basic", price_monthly=29900, price_yearly=299000, max_staff=10, max_revenue_entries=5000,
                                 features_json='["payroll","attendance","revenue","expense","profitloss"]'),
                SubscriptionPlan(name="Premium", price_monthly=59900, price_yearly=599000, max_staff=50, max_revenue_entries=50000,
                                 features_json='["payroll","attendance","revenue","expense","profitloss","card_sales","inventory","contracts","analytics"]'),
            ]
            for p in plans:
                s.add(p)
            s.commit()
            print("  OK: Free / Basic / Premium plans created")
        else:
            print(f"  ~ Already {len(existing_plans)} plans exist (skip)")
    
    # 4. Create default business (Sodam Gimbap)
    print("\n[4/5] Creating default business...")
    with Session(engine) as s:
        existing_biz = s.exec(select(Business)).first()
        if not existing_biz:
            basic_plan = s.exec(select(SubscriptionPlan).where(SubscriptionPlan.name == "Premium")).first()
            biz = Business(
                name="Sodam Gimbap",
                business_type="restaurant",
                owner_name="Admin",
                plan_id=basic_plan.id if basic_plan else None,
                subscription_start=date.today(),
            )
            s.add(biz)
            s.commit()
            s.refresh(biz)
            default_biz_id = biz.id
            print(f"  OK: Default business created (ID={default_biz_id})")
        else:
            default_biz_id = existing_biz.id
            print(f"  ~ Default business exists (ID={default_biz_id})")
    
    # 5. Assign existing data to default business
    print("\n[5/5] Assigning existing data to default business...")
    with Session(engine) as s:
        # Update Staff
        result = s.exec(text(f"UPDATE staff SET business_id = {default_biz_id} WHERE business_id IS NULL"))
        print(f"  + staff: assigned")
        
        # Update Vendor
        result = s.exec(text(f"UPDATE vendor SET business_id = {default_biz_id} WHERE business_id IS NULL"))
        print(f"  + vendor: assigned")
        
        # Update Revenue
        result = s.exec(text(f"UPDATE revenue SET business_id = {default_biz_id} WHERE business_id IS NULL"))
        print(f"  + revenue: assigned")
        
        # Update User
        result = s.exec(text(f'UPDATE "user" SET business_id = {default_biz_id} WHERE business_id IS NULL'))
        print(f"  + user: assigned")
        
        # Update Announcement
        result = s.exec(text(f"UPDATE announcement SET business_id = {default_biz_id} WHERE business_id IS NULL"))
        print(f"  + announcement: assigned")
        
        # Promote first admin user to superadmin
        admin_user = s.exec(select(User).where(User.role == "admin")).first()
        if admin_user:
            admin_user.role = "superadmin"
            s.add(admin_user)
            print(f"  + Promoted '{admin_user.username}' to superadmin")
        
        s.commit()
    
    print(f"\n{'=' * 60}")
    print("  Migration complete!")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    run_migration()
