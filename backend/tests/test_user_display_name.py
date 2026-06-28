import unittest
from unittest.mock import MagicMock

from app.utils.user_display_name import format_user_full_name, format_user_short_name


class UserDisplayNameTests(unittest.TestCase):
    def test_format_user_full_name(self):
        user = MagicMock()
        user.last_name = "Иванов"
        user.first_name = "Иван"
        user.patronymic = "Иванович"
        self.assertEqual(format_user_full_name(user), "Иванов Иван Иванович")

    def test_format_user_short_name(self):
        user = MagicMock()
        user.last_name = "Иванов"
        user.first_name = "Иван"
        user.patronymic = "Иванович"
        self.assertEqual(format_user_short_name(user), "Иванов И.И.")


if __name__ == "__main__":
    unittest.main()
