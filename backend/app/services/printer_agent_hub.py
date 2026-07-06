"""Маршрутизация команд агенту печати между Gunicorn workers через Redis."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Optional

from fastapi import WebSocket

from app.core.config import settings

logger = logging.getLogger(__name__)

PRINTER_COMMAND_CHANNEL = "printer:command"
PRINTER_ONLINE_KEY_PREFIX = "printer_agent:online:"
PRINTER_ONLINE_TTL_SECONDS = 120
HEARTBEAT_INTERVAL_SECONDS = 45


class PrinterAgentHub:
    def __init__(self) -> None:
        self._local: Dict[int, dict] = {}
        self._pubsub_task: Optional[asyncio.Task] = None
        self._pubsub_started = False
        self._send_locks: Dict[int, asyncio.Lock] = {}
        self._heartbeat_tasks: Dict[int, asyncio.Task] = {}

    def _online_key(self, agent_id: int) -> str:
        return f"{PRINTER_ONLINE_KEY_PREFIX}{agent_id}"

    async def start(self) -> None:
        if self._pubsub_started:
            return
        self._pubsub_started = True
        self._pubsub_task = asyncio.create_task(self._pubsub_listener())
        logger.info("Printer agent Redis pub/sub bridge started (channel=%s)", PRINTER_COMMAND_CHANNEL)

    async def stop(self) -> None:
        if self._pubsub_task:
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass
            self._pubsub_task = None
        self._pubsub_started = False
        for task in list(self._heartbeat_tasks.values()):
            task.cancel()
        self._heartbeat_tasks.clear()

    async def register(self, agent_id: int, websocket: WebSocket) -> None:
        self._local[agent_id] = {
            "websocket": websocket,
            "last_seen": datetime.utcnow().isoformat(),
        }
        await self._set_online(agent_id)
        prev = self._heartbeat_tasks.pop(agent_id, None)
        if prev:
            prev.cancel()
        self._heartbeat_tasks[agent_id] = asyncio.create_task(self._heartbeat_loop(agent_id))

    async def unregister(self, agent_id: int) -> None:
        self._local.pop(agent_id, None)
        self._send_locks.pop(agent_id, None)
        task = self._heartbeat_tasks.pop(agent_id, None)
        if task:
            task.cancel()
        await self._clear_online(agent_id)

    async def touch(self, agent_id: int) -> None:
        entry = self._local.get(agent_id)
        if entry:
            entry["last_seen"] = datetime.utcnow().isoformat()
        await self._set_online(agent_id)

    async def is_online(self, agent_id: int) -> bool:
        if agent_id in self._local:
            return True
        try:
            from redis.asyncio import Redis

            redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
            try:
                return bool(await redis.exists(self._online_key(agent_id)))
            finally:
                await redis.aclose()
        except Exception as exc:
            logger.warning("Printer online check failed for agent %s: %s", agent_id, exc)
            return agent_id in self._local

    async def filter_online(self, agent_ids: list[int]) -> list[int]:
        if not agent_ids:
            return []
        online_local = {aid for aid in agent_ids if aid in self._local}
        try:
            from redis.asyncio import Redis

            redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
            try:
                keys = [self._online_key(aid) for aid in agent_ids]
                values = await redis.mget(keys)
                online_redis = {aid for aid, val in zip(agent_ids, values) if val}
                return sorted(online_local | online_redis)
            finally:
                await redis.aclose()
        except Exception as exc:
            logger.warning("Printer filter_online failed: %s", exc)
            return sorted(online_local)

    async def send_command(self, agent_id: int, payload: dict) -> None:
        if not await self.is_online(agent_id):
            raise RuntimeError("Printer agent is not connected")

        message = json.dumps({"agent_id": agent_id, "payload": payload}, ensure_ascii=False)
        try:
            from redis.asyncio import Redis

            redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
            try:
                await redis.publish(PRINTER_COMMAND_CHANNEL, message)
            finally:
                await redis.aclose()
        except Exception as exc:
            logger.warning("Printer command publish failed, local fallback: %s", exc)
            await self._deliver_local(agent_id, payload)

    async def _deliver_local(self, agent_id: int, payload: dict) -> None:
        entry = self._local.get(agent_id)
        if not entry:
            return
        websocket = entry.get("websocket")
        if not websocket:
            return
        lock = self._send_locks.setdefault(agent_id, asyncio.Lock())
        async with lock:
            await websocket.send_json(payload)

    async def _pubsub_listener(self) -> None:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(PRINTER_COMMAND_CHANNEL)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    agent_id = data.get("agent_id")
                    payload = data.get("payload")
                    if agent_id is not None and payload is not None:
                        await self._deliver_local(int(agent_id), payload)
                except Exception as exc:
                    logger.warning("Printer pub/sub message handling failed: %s", exc)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Printer pub/sub listener stopped: %s", exc)
        finally:
            try:
                await pubsub.unsubscribe(PRINTER_COMMAND_CHANNEL)
                await pubsub.aclose()
                await redis.aclose()
            except Exception:
                pass

    async def _set_online(self, agent_id: int) -> None:
        try:
            from redis.asyncio import Redis

            redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
            try:
                await redis.setex(self._online_key(agent_id), PRINTER_ONLINE_TTL_SECONDS, "1")
            finally:
                await redis.aclose()
        except Exception as exc:
            logger.warning("Printer set_online failed for agent %s: %s", agent_id, exc)

    async def _clear_online(self, agent_id: int) -> None:
        try:
            from redis.asyncio import Redis

            redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
            try:
                await redis.delete(self._online_key(agent_id))
            finally:
                await redis.aclose()
        except Exception as exc:
            logger.warning("Printer clear_online failed for agent %s: %s", agent_id, exc)

    async def _heartbeat_loop(self, agent_id: int) -> None:
        try:
            while agent_id in self._local:
                await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
                entry = self._local.get(agent_id)
                if not entry:
                    break
                websocket = entry.get("websocket")
                if websocket:
                    try:
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        break
                await self._set_online(agent_id)
        except asyncio.CancelledError:
            pass


printer_hub = PrinterAgentHub()
