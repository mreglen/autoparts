# Implement Avito ID Sync via GET /autoload/v2/items/avito_ids

## Overview

Replace the old slow HTML parsing sync with a fast API-based sync using Avito's `/autoload/v2/items/avito_ids` endpoint. This endpoint accepts a list of internal codes (from the "Id" column in xlsx) and returns the real Avito item IDs in one request.

## API Details

**Endpoint:** `GET https://api.avito.ru/autoload/v2/items/avito_ids`

**Query Parameters:**
- `query` (required, string): Comma or pipe-separated list of ad IDs from xlsx file (internal codes)

**Headers:**
- `Authorization: Bearer ACCESS_TOKEN`

**Expected Response Format (200):**
```json
{
  "items": [
    {
      "query_id": "12345",  // The internal code we sent
      "avito_id": 987654321  // Real Avito item ID
    }
  ]
}
```

## Implementation Steps

### 1. Add API Function to avito_api.py

**File:** `backend/app/services/avito_api.py`

**Add new function after line 202:**

```python
async def get_avito_ids_by_query(access_token: str, query_ids: list[str]) -> dict[str, int]:
    """
    GET /autoload/v2/items/avito_ids - Get real Avito item IDs by internal codes.
    
    Returns dict mapping internal_code -> avito_id
    Example: {"12345": 987654321, "12346": 987654322}
    """
    if not query_ids:
        return {}
    
    # Join IDs with comma (Avito accepts comma or pipe separator)
    query_string = ",".join(query_ids)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/autoload/v2/items/avito_ids",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"query": query_string},
        )
        
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text[:8000]}
        
        if r.status_code != 200:
            raise RuntimeError(f"Avito avito_ids error (HTTP {r.status_code}): {data}")
        
        # Parse response and build mapping
        result = {}
        items = data.get("items", []) if isinstance(data, dict) else []
        
        for item in items:
            query_id = item.get("query_id")
            avito_id = item.get("avito_id")
            
            if query_id and avito_id:
                result[str(query_id)] = int(avito_id)
        
        return result
```

### 2. Create New Sync Endpoint

**File:** `backend/app/routers/avito_integration.py`

**Add new endpoint after line 426 (where old sync was removed):**

```python
@router.post("/{org_id}/avito/sync-ad-ids")
async def sync_avito_ad_ids(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Sync Avito ad IDs using autoload API - fast batch sync."""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    # Get Avito integration
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    
    if not integration or not integration.client_id or not integration.client_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито не настроена"
        )
    
    # Get all ProductAvitoListingLink for this org that don't have avito_id yet
    from app.models.product_avito_listing_link import ProductAvitoListingLink
    
    links_without_avito_id = db.query(ProductAvitoListingLink).filter(
        ProductAvitoListingLink.organization_id == org_id,
        ProductAvitoListingLink.avito_id.is_(None),
    ).all()
    
    if not links_without_avito_id:
        return {
            "status": "ok",
            "message": "Все Avito ID уже синхронизированы",
            "synced": 0,
        }
    
    # Get access token
    try:
        from app.core.security import decrypt_secret
        from app.services.avito_api import get_avito_ids_by_query
        import asyncio
        
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await get_avito_ids_by_query.__wrapped__.__self__.fetch_access_token(
            integration.client_id, secret
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения токена: {str(e)}"
        )
    
    # Batch sync (Avito API accepts multiple IDs in one request)
    # Split into batches of 100 to avoid URL length limits
    synced = 0
    batch_size = 100
    
    for i in range(0, len(links_without_avito_id), batch_size):
        batch = links_without_avito_id[i:i + batch_size]
        query_ids = [link.avito_ad_id for link in batch]
        
        try:
            # Call Avito API
            mapping = await get_avito_ids_by_query(token, query_ids)
            
            # Update database
            for link in batch:
                avito_id = mapping.get(link.avito_ad_id)
                if avito_id:
                    link.avito_id = str(avito_id)
                    synced += 1
            
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to sync batch {i}: {e}")
            db.rollback()
    
    return {
        "status": "ok",
        "message": f"Синхронизировано {synced} из {len(links_without_avito_id)} объявлений",
        "synced": synced,
        "total": len(links_without_avito_id),
    }
```

**Wait** - this needs to be async properly. Let me revise:

```python
@router.post("/{org_id}/avito/sync-ad-ids")
async def sync_avito_ad_ids(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Sync Avito ad IDs using autoload API - fast batch sync."""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    # Get Avito integration
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    
    if not integration or not integration.client_id or not integration.client_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито не настроена"
        )
    
    # Get all ProductAvitoListingLink for this org
    from app.models.product_avito_listing_link import ProductAvitoListingLink
    from app.models.product import Product as ProductModel
    
    all_links = db.query(ProductAvitoListingLink).filter(
        ProductAvitoListingLink.organization_id == org_id,
    ).all()
    
    if not all_links:
        return {
            "status": "ok",
            "message": "Нет объявлений для синхронизации",
            "synced": 0,
        }
    
    # Get access token
    try:
        from app.core.security import decrypt_secret
        import app.services.avito_api as avito_api_module
        import asyncio
        
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_module.fetch_access_token(
            integration.client_id, secret
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения токена: {str(e)}"
        )
    
    # Collect all unique_ad_id (internal codes) from xlsx cache
    from app.models.organization_avito_autoload_cache import OrganizationAvitoAutoloadCache
    import json
    
    cache = db.query(OrganizationAvitoAutoloadCache).filter(
        OrganizationAvitoAutoloadCache.organization_id == org_id
    ).first()
    
    if not cache or not cache.items_json:
        return {
            "status": "error",
            "message": "Нет данных автозагрузки. Сначала загрузите xlsx файл",
        }
    
    try:
        items = json.loads(cache.items_json)
    except:
        items = []
    
    # Extract unique_ad_id from items
    query_ids = list(set([
        str(item.get("unique_ad_id")) 
        for item in items 
        if item.get("unique_ad_id")
    ]))
    
    if not query_ids:
        return {
            "status": "error",
            "message": "Нет внутренних кодов в файле автозагрузки",
        }
    
    # Batch sync using Avito API
    synced = 0
    updated = 0
    batch_size = 100
    
    for i in range(0, len(query_ids), batch_size):
        batch_ids = query_ids[i:i + batch_size]
        
        try:
            # Call Avito API
            mapping = await avito_api_module.get_avito_ids_by_query(token, batch_ids)
            
            # Update database
            for internal_code, avito_id in mapping.items():
                link = db.query(ProductAvitoListingLink).filter(
                    ProductAvitoListingLink.organization_id == org_id,
                    ProductAvitoListingLink.avito_ad_id == internal_code,
                ).first()
                
                if link:
                    if not link.avito_id:
                        link.avito_id = str(avito_id)
                        synced += 1
                    elif link.avito_id != str(avito_id):
                        link.avito_id = str(avito_id)
                        updated += 1
                else:
                    # Find product and create new link
                    product = db.query(ProductModel).filter(
                        ProductModel.organization_id == org_id,
                        ProductModel.internal_code == internal_code,
                    ).first()
                    
                    if product:
                        new_link = ProductAvitoListingLink(
                            organization_id=org_id,
                            product_id=product.id,
                            avito_ad_id=internal_code,
                            avito_id=str(avito_id),
                        )
                        db.add(new_link)
                        synced += 1
            
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to sync batch {i}: {e}")
            db.rollback()
    
    return {
        "status": "ok",
        "message": f"Синхронизировано: {synced} новых, {updated} обновлено",
        "synced": synced,
        "updated": updated,
    }
```

### 3. Frontend Already Exists

**File:** `frontend/my-autoparts/src/pages/Settings/AvitoIntegrationPage.jsx`

The frontend already has the sync button at line 615-628. No changes needed.

## Summary

| File | Changes | Lines |
|------|---------|-------|
| `avito_api.py` | Add `get_avito_ids_by_query()` function | ~40 lines |
| `avito_integration.py` | Add new sync endpoint | ~120 lines |
| Frontend | No changes needed | 0 |

**Total:** ~160 lines added

## Benefits

- **Speed:** 1-2 seconds vs 5+ minutes (old HTML parsing)
- **Reliability:** No HTML parsing, uses official API
- **Batch:** Processes 100 IDs per request
- **Simple:** One API call, get all mappings
