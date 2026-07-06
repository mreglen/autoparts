import unittest
from unittest.mock import MagicMock

from app.models.organization import Organization
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.services.seller_onboarding_service import CORE_STEP_IDS, get_seller_onboarding


class SellerOnboardingServiceTests(unittest.TestCase):
    def _seller(self, *, org_id="org-1", is_seller=True, is_director=False):
        user = MagicMock()
        user.organization_id = org_id
        user.is_seller = is_seller
        user.is_director = is_director
        return user

    def _make_db(
        self,
        *,
        org=None,
        scalars=None,
        avito_row=None,
    ):
        scalars = list(scalars or [0, 0, 0, 0, 0, 0])
        call_idx = {"n": 0}
        db = MagicMock()

        def query_side_effect(model_or_expr, *_args, **_kwargs):
            q = MagicMock()
            q.filter.return_value = q
            q.join.return_value = q
            idx = call_idx["n"]
            call_idx["n"] += 1

            if model_or_expr is Organization:
                q.filter.return_value.first.return_value = org
            elif model_or_expr is OrganizationAvitoIntegration:
                q.filter.return_value.first.return_value = avito_row
            else:
                q.scalar.return_value = scalars.pop(0) if scalars else 0
            return q

        db.query.side_effect = query_side_effect
        return db

    def test_no_organization_id_returns_empty(self):
        user = self._seller(org_id=None)
        db = MagicMock()

        result = get_seller_onboarding(db, user)

        self.assertEqual(result.steps, [])
        self.assertFalse(result.core_completed)
        self.assertEqual(result.core_progress.done, 0)
        self.assertEqual(result.core_progress.total, len(CORE_STEP_IDS))
        db.query.assert_not_called()

    def test_org_incomplete_marks_profile_pending(self):
        org = MagicMock()
        org.phone = None
        org.description = "Some text"
        db = self._make_db(org=org, scalars=[0, 0, 0, 0, 0, 0])

        result = get_seller_onboarding(db, self._seller())

        step_map = {s.id: s for s in result.steps}
        self.assertEqual(step_map["organization_profile"].status, "pending")
        self.assertTrue(step_map["organization_profile"].required)
        self.assertFalse(result.core_completed)
        self.assertEqual(result.core_progress.done, 0)

    def test_core_completed_when_all_required_steps_done(self):
        org = MagicMock()
        org.phone = "+79990001122"
        org.description = "Описание организации"
        db = self._make_db(
            org=org,
            scalars=[1, 1, 0, 1, 0, 0],
            avito_row=None,
        )

        result = get_seller_onboarding(db, self._seller())

        step_map = {s.id: s for s in result.steps}
        for step_id in CORE_STEP_IDS:
            self.assertEqual(step_map[step_id].status, "done", step_id)

        self.assertTrue(result.core_completed)
        self.assertEqual(result.core_progress.done, len(CORE_STEP_IDS))
        self.assertEqual(result.core_progress.total, len(CORE_STEP_IDS))

    def test_optional_steps_flags_and_pending_count(self):
        org = MagicMock()
        org.phone = "+79990001122"
        org.description = "Описание"
        db = self._make_db(org=org, scalars=[1, 0, 0, 0, 0, 0])

        result = get_seller_onboarding(db, self._seller())

        optional = [s for s in result.steps if not s.required]
        self.assertGreater(len(optional), 0)
        self.assertTrue(all(s.id in {"email_verified", "storage_cell", "print_setup", "avito_connected"} or not s.required for s in optional))

        pending_optional = [s for s in optional if s.status == "pending"]
        self.assertEqual(result.optional_pending, len(pending_optional))

        self.assertEqual(
            {s.id for s in result.steps if s.required and s.id in CORE_STEP_IDS},
            CORE_STEP_IDS,
        )


if __name__ == "__main__":
    unittest.main()
