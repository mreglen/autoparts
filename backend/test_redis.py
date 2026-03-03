"""
Test Redis connection
"""
import redis
from app.core.config import settings

print("Testing Redis connection...")
print(f"Redis URL: {settings.REDIS_URL}")

try:
    # Parse Redis URL
    redis_url = settings.REDIS_URL
    print(f"Connecting to: {redis_url}")
    
    # Create Redis client
    r = redis.from_url(redis_url)
    
    # Test connection
    result = r.ping()
    print(f"✓ Redis ping successful: {result}")
    
    # Test set/get
    r.set('test_key', 'test_value')
    value = r.get('test_key')
    print(f"✓ Redis set/get successful: {value.decode()}")
    
    print("\n✅ Redis is working correctly!")
    
except Exception as e:
    print(f"\n❌ Redis connection failed: {e}")
    print("\nMake sure Redis server is running:")
    print("  Windows: redis-server.exe")
    print("  Linux/Mac: redis-server")
