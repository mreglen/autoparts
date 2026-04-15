import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

AVITO_BASE = "https://api.avito.ru"


async def fetch_access_token(client_id: str, client_secret: str) -> str:
    """OAuth2 client_credentials. Сначала POST form, затем GET /token/ как в публичном Swagger Авито."""
    last: Optional[httpx.Response] = None
    async with httpx.AsyncClient(timeout=45.0) as client:
        r_post = await client.post(
            f"{AVITO_BASE}/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        last = r_post
        if r_post.status_code == 200:
            data = r_post.json()
            token = data.get("access_token")
            if token:
                return token
            raise RuntimeError(f"Ответ /token без access_token: {data}")

        r_get = await client.get(
            f"{AVITO_BASE}/token/",
            params={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        last = r_get
        if r_get.status_code == 200:
            data = r_get.json()
            token = data.get("access_token")
            if token:
                return token
            raise RuntimeError(f"Ответ /token/ без access_token: {data}")

    body = (last.text[:800] if last else "") or ""
    logger.warning("Avito OAuth не удался: %s %s", last.status_code if last else "?", body)
    raise RuntimeError(f"Не удалось получить токен Авито (HTTP {last.status_code if last else '?'}): {body}")


async def get_autoload_user_docs_tree(access_token: str) -> dict[str, Any]:
    """GET /autoload/v1/user-docs/tree — дерево категорий и параметров автозагрузки."""
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/autoload/v1/user-docs/tree",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        try:
            data: Any = r.json()
        except Exception:
            data = {"raw": r.text[:8000]}
        if r.status_code != 200:
            raise RuntimeError(f"Avito tree error (HTTP {r.status_code}): {data}")
        if isinstance(data, dict):
            return data
        return {"data": data}


async def upload_autoload_xlsx(access_token: str, filename: str, file_bytes: bytes) -> tuple[int, dict[str, Any]]:
    """
    Загрузка файла автозагрузки. Эндпоинт: POST /autoload/v1/upload
    Пробуем несколько имён поля multipart — спецификация в публичных источниках не всегда совпадает.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    last_status = 0
    last_body: Any = None

    async with httpx.AsyncClient(timeout=120.0) as client:
        for field in ("file", "upload", "content"):
            files = {field: (filename, file_bytes, content_type)}
            r = await client.post(f"{AVITO_BASE}/autoload/v1/upload", headers=headers, files=files)
            last_status = r.status_code
            try:
                last_body = r.json()
            except Exception:
                last_body = {"raw": r.text[:8000]}

            if r.status_code in (200, 201):
                return r.status_code, last_body if isinstance(last_body, dict) else {"result": last_body}

            if r.status_code == 404:
                continue

            return r.status_code, last_body if isinstance(last_body, dict) else {"error": str(last_body)}

    return last_status, last_body if isinstance(last_body, dict) else {"error": str(last_body)}


async def get_last_completed_report_v3(access_token: str) -> Optional[dict[str, Any]]:
    """Опционально: последний завершённый отчёт (новее, чем v1 last_report)."""
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/autoload/v3/reports/last_completed_report",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except Exception:
            return None


async def get_last_report_v1(access_token: str, user_id: int) -> Optional[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/autoload/v1/accounts/{user_id}/reports/last_report/",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except Exception:
            return None


async def get_avito_items_list(access_token: str, user_id: int) -> list[dict[str, Any]]:
    """
    GET /core/v1/items - Get list of all ads for the user.
    Returns list of items with basic info including item_id.
    
    According to Avito docs:
    https://developers.avito.ru/api-catalog/itemmgmt/documentation#operation/getItems
    
    Response structure:
    {
      "meta": {...},
      "resources": [
        {
          "id": 12345678,
          "address": "...",
          "category": {"id": 111},
          "price": 5000,
          "status": "active",
          "title": "...",
          "url": "..."
        }
      ]
    }
    """
    items = []
    page = 1
    per_page = 100
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Fetch all pages
        while True:
            r = await client.get(
                f"{AVITO_BASE}/core/v1/items",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"per_page": per_page, "page": page, "status": "active"},
            )
            try:
                data = r.json()
            except Exception:
                data = {"raw": r.text[:8000]}
            
            if r.status_code != 200:
                raise RuntimeError(f"Avito items list error (HTTP {r.status_code}): {data}")
            
            # Extract items from response - Avito returns "resources" array
            page_items = []
            if isinstance(data, dict):
                # Try "resources" first (correct field name), then fallback to "items" or "data"
                page_items = data.get("resources", []) or data.get("items", []) or data.get("data", []) or []
            elif isinstance(data, list):
                page_items = data
            
            items.extend(page_items)
            
            # Check if there are more pages
            total_items = 0
            if isinstance(data, dict):
                meta = data.get("meta", {})
                total_items = meta.get("total", meta.get("totalCount", 0))
            
            if len(page_items) < per_page or len(items) >= total_items:
                break
            
            page += 1
            
            # Safety limit to prevent infinite loops
            if page > 100:
                print(f"⚠️ Reached safety limit of 100 pages, stopping")
                break
    
    print(f"✅ Fetched {len(items)} items from Avito API")
    return items


async def get_avito_item_detail(access_token: str, user_id: int, item_id: str) -> dict[str, Any]:
    """
    GET /core/v1/accounts/{user_id}/items/{item_id}/ - Get detailed ad info including description.
    Returns full item data with description field.
    """
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/core/v1/accounts/{user_id}/items/{item_id}/",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text[:8000]}
        
        if r.status_code != 200:
            raise RuntimeError(f"Avito item detail error (HTTP {r.status_code}): {data}")
        
        return data if isinstance(data, dict) else {}


async def fetch_avito_item_page_html(item_url: str) -> str:
    """
    Fetch the HTML content of an Avito item page by URL.
    Used to parse description from the page when API doesn't return it.
    """
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        r = await client.get(
            item_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
        )
        if r.status_code != 200:
            raise RuntimeError(f"Failed to fetch Avito page {item_url}: HTTP {r.status_code}")
        return r.text


def extract_description_from_html(html: str) -> str:
    """
    Extract description text from Avito item HTML page.
    Looks for description in meta tags or script data.
    """
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        # Try to find description in meta tags
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            return meta_desc['content']
        
        # Try to find in JSON-LD or script data
        # Avito often embeds data in script tags
        for script in soup.find_all('script', type='application/ld+json'):
            if script.string:
                try:
                    import json
                    data = json.loads(script.string)
                    if isinstance(data, dict) and 'description' in data:
                        return data['description']
                except:
                    pass
        
        # Fallback: look for any element with description-like class
        desc_element = soup.find(class_=lambda x: x and 'description' in x.lower())
        if desc_element:
            return desc_element.get_text(strip=True)
        
        return ""
    except Exception as e:
        print(f"⚠️ Error extracting description from HTML: {e}")
        return ""
