import unittest

from app.utils.autoservice_payer_requisites import (
    apply_person_type_defaults,
    payer_catalog_name,
)


class AutoservicePayerRequisitesTests(unittest.TestCase):
    class _Row:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    def test_catalog_name_for_individual(self):
        self.assertEqual(
            payer_catalog_name("individual", "Иванов Иван", None),
            "Иванов Иван",
        )

    def test_catalog_name_for_ie(self):
        self.assertEqual(
            payer_catalog_name("ie", "Иванов Иван", "ИП Иванов"),
            "ИП Иванов",
        )
        self.assertEqual(
            payer_catalog_name("ie", "Иванов Иван", None),
            "ИП Иванов Иван",
        )

    def test_catalog_name_for_legal(self):
        self.assertEqual(
            payer_catalog_name("legal", "Иванов", "ООО Ромашка"),
            "ООО Ромашка",
        )

    def test_apply_person_type_defaults(self):
        row = self._Row(
            person_type="individual",
            legal_name="ООО",
            kpp="123",
            ogrn="456",
        )
        apply_person_type_defaults(row)
        self.assertIsNone(row.legal_name)
        self.assertIsNone(row.kpp)
        self.assertIsNone(row.ogrn)


if __name__ == "__main__":
    unittest.main()
