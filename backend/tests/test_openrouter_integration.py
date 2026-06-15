import unittest
from unittest.mock import MagicMock, patch

from app.services.ai_description_service import (
    RECOMMENDED_FREE_MODELS,
    _build_user_prompt,
    _normalize_description,
    get_seller_access_info,
    is_org_ai_description_enabled,
)
from app.services.openrouter_service import (
    OpenRouterApiError,
    OpenRouterCompletionResult,
    _extract_message_content,
    chat_completion,
    normalize_openrouter_api_key,
)
from app.utils.openrouter_crypto import decrypt_openrouter_secret, encrypt_openrouter_secret

VALID_API_KEY = "sk-or-v1-test-key-1234567890"


class OpenRouterCryptoTests(unittest.TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        plain = VALID_API_KEY
        token = encrypt_openrouter_secret(plain)
        self.assertNotEqual(token, plain)
        self.assertEqual(decrypt_openrouter_secret(token), plain)


class OpenRouterApiKeyValidationTests(unittest.TestCase):
    def test_normalize_rejects_cyrillic_api_key(self):
        with self.assertRaises(OpenRouterApiError) as ctx:
            normalize_openrouter_api_key("sk-or-v1-" + "a" * 64 + "Создавай")
        self.assertIn("недопустимые символы", str(ctx.exception))

    def test_normalize_rejects_invalid_prefix(self):
        with self.assertRaises(OpenRouterApiError):
            normalize_openrouter_api_key("sk-test-key-1234567890")

    def test_normalize_accepts_valid_key(self):
        self.assertEqual(normalize_openrouter_api_key(f"  {VALID_API_KEY}  "), VALID_API_KEY)


class OpenRouterServiceTests(unittest.TestCase):
    def test_extract_message_content_from_list(self):
        content = _extract_message_content(
            {"content": [{"type": "text", "text": "Описание подшипника."}]}
        )
        self.assertEqual(content, "Описание подшипника.")

    def test_extract_message_content_from_string(self):
        content = _extract_message_content({"content": "  Текст  "})
        self.assertEqual(content, "Текст")

    @patch("app.services.openrouter_service._post_openrouter")
    def test_chat_completion_success(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(
                return_value={
                    "model": "meta-llama/llama-3.3-70b-instruct:free",
                    "choices": [{"message": {"content": "Тестовое описание подшипника."}}],
                    "usage": {"total_tokens": 42},
                }
            ),
            text="",
        )

        result = chat_completion(
            api_key=VALID_API_KEY,
            model="meta-llama/llama-3.3-70b-instruct:free",
            system_prompt="sys",
            user_prompt="user",
        )
        self.assertIsInstance(result, OpenRouterCompletionResult)
        self.assertIn("описание", result.content)
        self.assertEqual(result.tokens_used, 42)
        call_kwargs = mock_post.call_args.kwargs
        self.assertIsInstance(call_kwargs["body"], bytes)
        headers = call_kwargs.get("headers") or {}
        self.assertIn("charset=utf-8", headers.get("Content-Type", ""))
        mock_post.assert_called_once()

    @patch("app.services.openrouter_service._post_openrouter")
    def test_chat_completion_sends_utf8_body_for_cyrillic_prompt(self, mock_post):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=MagicMock(
                return_value={
                    "model": "meta-llama/llama-3.3-70b-instruct:free",
                    "choices": [{"message": {"content": "Описание."}}],
                    "usage": {"total_tokens": 10},
                }
            ),
            text="",
        )

        chat_completion(
            api_key=VALID_API_KEY,
            model="meta-llama/llama-3.3-70b-instruct:free",
            system_prompt="Пиши только на русском языке.",
            user_prompt="Бренд: Koyo\nАртикул: 608ZZ\nНазвание: Подшипник",
        )
        body = mock_post.call_args.kwargs["body"]
        self.assertIn("Подшипник".encode("utf-8"), body)

    @patch("app.services.openrouter_service._post_openrouter")
    def test_chat_completion_api_error(self, mock_post):
        mock_post.return_value = MagicMock(status_code=429, text="rate limited")

        with self.assertRaises(OpenRouterApiError) as ctx:
            chat_completion(
                api_key=VALID_API_KEY,
                model="meta-llama/llama-3.3-70b-instruct:free",
                system_prompt="sys",
                user_prompt="user",
            )
        self.assertEqual(ctx.exception.status_code, 429)

    @patch("app.services.openrouter_service._post_openrouter")
    def test_chat_completion_rejects_cyrillic_api_key_before_http(self, mock_post):
        contaminated_key = "sk-or-v1-" + "a" * 64 + "Создавай"
        with self.assertRaises(OpenRouterApiError) as ctx:
            chat_completion(
                api_key=contaminated_key,
                model="meta-llama/llama-3.3-70b-instruct:free",
                system_prompt="sys",
                user_prompt="user",
            )
        self.assertIn("недопустимые символы", str(ctx.exception))
        mock_post.assert_not_called()


class AiDescriptionServiceTests(unittest.TestCase):
    def test_build_user_prompt_includes_facts(self):
        prompt = _build_user_prompt(
            brand="Koyo",
            article="608ZZ",
            name="Подшипник",
            is_new=True,
            part_type_name="Подшипник",
        )
        self.assertIn("Koyo", prompt)
        self.assertIn("608ZZ", prompt)
        self.assertIn("новая", prompt)

    def test_normalize_description_truncates(self):
        long_text = "а" * 3000
        normalized = _normalize_description(long_text)
        self.assertLessEqual(len(normalized), 2000)

    def test_recommended_models_include_free_suffix(self):
        for model in RECOMMENDED_FREE_MODELS:
            if model == "openrouter/free":
                continue
            self.assertTrue(model.endswith(":free"), model)

    def test_is_org_ai_description_enabled_false_without_row(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        self.assertFalse(is_org_ai_description_enabled(db, "org1"))

    def test_get_seller_access_info_disabled_for_non_seller(self):
        db = MagicMock()
        integration = MagicMock()
        integration.is_enabled = True
        integration.api_key_encrypted = "enc"
        integration.daily_limit = 50
        integration.per_org_daily_limit = 10
        integration.requests_today = 0
        integration.requests_today_date = None

        user = MagicMock()
        user.is_seller = False
        user.is_director = False
        user.is_employee = False
        user.organization_id = "org1"

        with patch(
            "app.services.ai_description_service.get_or_create_openrouter_integration",
            return_value=integration,
        ), patch(
            "app.services.ai_description_service.is_org_ai_description_enabled",
            return_value=True,
        ), patch(
            "app.services.ai_description_service.count_org_requests_today",
            return_value=0,
        ):
            info = get_seller_access_info(db, user)
        self.assertFalse(info["show_ui"])
        self.assertFalse(info["enabled"])


if __name__ == "__main__":
    unittest.main()
