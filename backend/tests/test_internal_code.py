import unittest

from app.utils.internal_code import (
    build_internal_code,
    int_to_letters,
    is_valid_internal_code,
    letters_to_int,
    org_prefix,
    parse_internal_code,
)


class InternalCodeUtilsTests(unittest.TestCase):
    def test_org_prefix(self):
        self.assertEqual(org_prefix("qMHbBIoD51"), "QMHB")

    def test_int_to_letters_roundtrip(self):
        for n in (0, 1, 25, 26, 100, 999_999):
            letters = int_to_letters(n)
            self.assertEqual(len(letters), 5)
            self.assertTrue(all("A" <= ch <= "Z" for ch in letters))
            self.assertEqual(letters_to_int(letters), n)

    def test_first_codes(self):
        self.assertEqual(int_to_letters(0), "AAAAA")
        self.assertEqual(int_to_letters(1), "AAAAB")
        self.assertEqual(int_to_letters(25), "AAAAZ")
        self.assertEqual(int_to_letters(26), "AAABA")

    def test_million_boundary(self):
        million_suffix = int_to_letters(999_999)
        self.assertEqual(len(million_suffix), 5)
        self.assertGreater(letters_to_int(million_suffix), 999_000)

    def test_build_and_parse(self):
        code = build_internal_code("abcdEFgh12", 42)
        self.assertEqual(code, "ABCD-AAABQ")
        self.assertTrue(is_valid_internal_code(code))
        parsed = parse_internal_code(code)
        self.assertEqual(parsed, ("ABCD", "AAABQ"))

    def test_validation(self):
        self.assertTrue(is_valid_internal_code("QMHB-AAAAA"))
        self.assertTrue(is_valid_internal_code("QMH1-ZZZZZ"))
        self.assertFalse(is_valid_internal_code("00001"))
        self.assertFalse(is_valid_internal_code("QMHB-AAAA"))
        self.assertFalse(is_valid_internal_code("QMHB-AAAAAA"))


if __name__ == "__main__":
    unittest.main()
