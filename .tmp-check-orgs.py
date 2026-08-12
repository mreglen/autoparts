import os
import sys

sys.path.insert(0, "/home/fast/autoparts/backend")
os.chdir("/home/fast/autoparts/backend")

from app.db.database import SessionLocal
from app.models.organization import Organization
from app.models.user import User
from app.utils.org_markup import effective_markup_percent
from app.utils.site_settings_db import get_or_create_site_settings

db = SessionLocal()
row = get_or_create_site_settings(db)
print("buyer     =", row.buyer_new_parts_markup_percent)
print("seller    =", row.new_parts_markup_percent)
print("autoservice=", row.autoservice_new_parts_markup_percent)
print()

orgs = db.query(Organization).filter(Organization.is_autoservice.is_(True)).all()
for org in orgs:
    print(f"ORG {org.id} | {org.name}")
    print(f"   is_autoservice={org.is_autoservice} paused={org.autoservice_paused}")
    print(f"   effective_markup={effective_markup_percent(org, row)}")
    users = db.query(User).filter(User.organization_id == org.id).all()
    for u in users:
        flag = bool(org.is_autoservice and not org.autoservice_paused)
        print(
            f"   user {u.id} {u.email} admin={u.is_admin} seller={u.is_seller} "
            f"director={u.is_director} employee={u.is_employee} -> organization_is_autoservice={flag}"
        )
    print()
db.close()
