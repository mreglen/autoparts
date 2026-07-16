import unittest

from app.services.label_qr_resolve_service import (
    build_label_qr_path,
    normalize_label_internal_code,
)


class LabelQrResolveServiceTests(unittest.TestCase):
    def test_normalize_code(self):
        self.assertEqual(normalize_label_internal_code(' tvgp-aabbp '), 'TVGP-AABBP')
        self.assertEqual(normalize_label_internal_code('—'), '')

    def test_build_path(self):
        self.assertEqual(build_label_qr_path('TVGP-AABBP'), '/qr/label/TVGP-AABBP')
        self.assertEqual(build_label_qr_path(''), '')


if __name__ == '__main__':
    unittest.main()
