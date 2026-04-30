import asyncio
from typing import Awaitable, Callable, Dict, TypeVar

T = TypeVar("T")


class SingleFlight:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._inflight: Dict[str, asyncio.Future] = {}

    async def do(self, key: str, task_factory: Callable[[], Awaitable[T]]) -> T:
        async with self._lock:
            existing = self._inflight.get(key)
            if existing is not None:
                future = existing
                is_leader = False
            else:
                loop = asyncio.get_running_loop()
                future = loop.create_future()
                self._inflight[key] = future
                is_leader = True

        if not is_leader:
            return await future

        try:
            result = await task_factory()
            future.set_result(result)
            return result
        except Exception as exc:
            future.set_exception(exc)
            raise
        finally:
            async with self._lock:
                self._inflight.pop(key, None)
