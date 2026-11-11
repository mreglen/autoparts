import unittest

from app.main import app

SPEC = app.openapi()

# Маршруты, которые читает мобильное приложение. Для кодогена важен тип ответа:
# маршрут без схемы превращается в `unknown`, и смысл генерации теряется.
JSON_ROUTES = [
    ("get", "/api/mobile/meta"),
    ("get", "/api/autoservice/repair-orders"),
    ("get", "/api/autoservice/repair-orders/{order_id}"),
    ("get", "/api/autoservice/clients/page"),
    ("get", "/api/autoservice/contractors/page"),
    ("get", "/api/autoservice/works/page"),
    ("get", "/api/autoservice/inspection-bookings/page"),
    ("get", "/api/organizations/{org_id}/employee-cards/page"),
    ("get", "/api/autoservice/warehouse/items/page"),
    ("get", "/api/autoservice/warehouse/receipts/page"),
    ("get", "/api/autoservice/warehouse/receipts/lines/page"),
    ("get", "/api/autoservice/warehouse/expenses/page"),
    ("get", "/api/autoservice/warehouse/purchase-lots/page"),
    ("get", "/api/autoservice/warehouse/returns/page"),
    ("get", "/api/autoservice/finance/receipts"),
    ("get", "/api/autoservice/reports/payroll"),
    ("get", "/api/autoservice/reports/order-economics"),
    ("get", "/api/autoservice/reports/warehouse-stock"),
    ("get", "/api/autoservice/reports/rossko-sales"),
    ("get", "/api/autoservice/clients/me/orgs"),
    ("get", "/api/autoservice/applications/tariff-info"),
    ("get", "/api/autoservice/applications/me"),
    ("post", "/api/autoservice/applications"),
    ("post", "/api/autoservice/calendar-sync/sync-from-calendar"),
    ("put", "/api/organizations/{org_id}/employee-cards/{card_id}/permissions"),
    ("get", "/api/tasks/{task_id}"),
]

BINARY_ROUTES = [
    ("get", "/api/autoservice/repair-orders/{order_id}/pdf", "application/pdf"),
    ("get", "/api/autoservice/finance/receipts.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("get", "/api/autoservice/reports/payroll.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("get", "/api/autoservice/reports/order-economics.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("get", "/api/autoservice/reports/warehouse-stock.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("get", "/api/autoservice/reports/rossko-sales.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
]


def _operation(method: str, path: str) -> dict:
    return SPEC["paths"][path][method]


def _success_content(method: str, path: str) -> dict:
    responses = _operation(method, path)["responses"]
    code = "201" if method == "post" and "201" in responses else "200"
    return responses[code].get("content", {})


class OpenApiContractHygieneTests(unittest.TestCase):
    def test_mobile_routes_declare_a_response_schema(self):
        for method, path in JSON_ROUTES:
            with self.subTest(path=path, method=method):
                content = _success_content(method, path)
                self.assertEqual(list(content), ["application/json"], path)
                schema = content["application/json"]["schema"]
                self.assertTrue(
                    schema.get("$ref")
                    or schema.get("items")
                    or schema.get("additionalProperties") is not None
                    or schema.get("type") == "object",
                    f"{path} отдаёт схему без полей: {schema}",
                )

    def test_binary_routes_advertise_only_their_media_type(self):
        for method, path, media_type in BINARY_ROUTES:
            with self.subTest(path=path):
                self.assertEqual(list(_success_content(method, path)), [media_type], path)

    def test_repeated_query_params_use_exploded_form_serialization(self):
        params = {p["name"]: p for p in _operation("get", "/api/autoservice/repair-orders")["parameters"]}
        for name in ("status", "work_zone_id", "payment"):
            with self.subTest(param=name):
                param = params[name]
                schema = param["schema"]
                array = next(s for s in schema["anyOf"] if s.get("type") == "array")
                self.assertEqual(array["items"]["type"], "string", name)
                # Открытый список значений обязан читаться как ?status=a&status=b.
                # FastAPI пишет explode внутрь схемы, поэтому проверяем обе позиции:
                # отсутствие ключа тоже корректно — OpenAPI по умолчанию даёт form + explode.
                self.assertEqual(param.get("style", "form"), "form", name)
                self.assertIsNot(param.get("explode"), False, name)
                self.assertIsNot(schema.get("explode"), False, name)

    def test_page_routes_share_the_page_envelope(self):
        for method, path in JSON_ROUTES:
            if not path.endswith("/page"):
                continue
            with self.subTest(path=path):
                schema = _success_content(method, path)["application/json"]["schema"]
                fields = set(SPEC["components"]["schemas"][schema["$ref"].split("/")[-1]]["properties"])
                self.assertEqual(fields, {"items", "total", "has_more", "fetched_at"}, path)


if __name__ == "__main__":
    unittest.main()
