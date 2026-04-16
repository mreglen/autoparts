апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:     connection open
апр 15 22:12:42 vm2512296768 uvicorn[41263]: [WS] Connection attempt for user_id=2
апр 15 22:12:42 vm2512296768 uvicorn[41263]: [WS] Client: Address(host='178.78.61.251', port=0)
апр 15 22:12:42 vm2512296768 uvicorn[41263]: [WS] Successfully connected user_id=2
апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/chats/?skip=0&limit=50 HTTP/1.0" 200 OK
апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:httpx:HTTP Request: POST https://api.avito.ru/token "HTTP/1.1 200 OK"
апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:httpx:HTTP Request: GET https://api.avito.ru/messenger/v3/accounts/199827112/chats/?limit=100 "HTTP/1.1 404 Not Found"
апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:httpx:HTTP Request: GET https://api.avito.ru/messenger/v3/accounts/199827112/chats?limit=100 "HTTP/1.1 404 Not Found"
апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:httpx:HTTP Request: GET https://api.avito.ru/messenger/v2/accounts/199827112/chats?limit=100 "HTTP/1.1 200 OK"
апр 15 22:12:42 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats HTTP/1.0" 200 OK
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito:
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito:
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito:
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito:
апр 15 22:13:43 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-8fwtXyCJoxzJNYNJbquARw/product-link HTTP/1.0" 200 OK
апр 15 22:13:43 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-9s3XxgbaxcTbZzuGD_92mQ/product-link HTTP/1.0" 200 OK
апр 15 22:13:43 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-tDQFJ~DKU7ieNEPqzbti5g/product-link HTTP/1.0" 200 OK
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito:
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito:
апр 15 22:13:43 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-Bwjz584uQ~1oedN_0qYVaA/product-link HTTP/1.0" 500 Internal Server Error
апр 15 22:13:43 vm2512296768 uvicorn[41263]: ERROR:    Exception in ASGI application
апр 15 22:13:43 vm2512296768 uvicorn[41263]: Traceback (most recent call last):
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/protocols/http/httptools_impl.py", line 409, in run_asgi
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     result = await app(  # type: ignore[func-returns-value]
апр 15 22:13:43 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return await self.app(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/applications.py", line 1134, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await super().__call__(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/applications.py", line 113, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, _send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 191, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     with recv_stream, send_stream, collapse_excgroups():
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     self.gen.throw(value)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_utils.py", line 85, in collapse_excgroups
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 193, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     response = await self.dispatch_func(request, call_next)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 100, in handle_large_files
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raise e
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 92, in handle_large_files
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     response = await call_next(request)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 168, in call_next
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raise app_exc from app_exc.__cause__ or app_exc.__context__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 144, in coro
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.app(scope, receive_or_disconnect, send_no_error)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 85, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await route.handle(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 125, in app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 111, in app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     response = await f(request)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 391, in app
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     raw_response = await run_endpoint_function(
апр 15 22:13:43 vm2512296768 uvicorn[41263]:                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 290, in run_endpoint_function
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return await dependant.call(**values)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/routers/avito_messenger.py", line 101, in get_avito_chat_product_link
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     if not current_user.organization_id:
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/attributes.py", line 569, in __get__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return self.impl.get(state, dict_)  # type: ignore[no-any-return]
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/attributes.py", line 1096, in get
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     value = self._fire_loader_callables(state, key, passive)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/attributes.py", line 1126, in _fire_loader_callables
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return state._load_expired(state, passive)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/state.py", line 803, in _load_expired
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     self.manager.expired_attribute_loader(self, toload, passive)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 1674, in load_scalar_attributes
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     result = load_on_ident(
апр 15 22:13:43 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 510, in load_on_ident
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return load_on_pk_identity(
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 695, in load_on_pk_identity
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     session.execute(
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2351, in execute
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return self._execute_internal(
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2239, in _execute_internal
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     conn = self._connection_for_bind(bind)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2108, in _connection_for_bind
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return trans._connection_for_bind(engine, execution_options)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "<string>", line 2, in _connection_for_bind
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/state_changes.py", line 137, in _go
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     ret_value = fn(self, *arg, **kw)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:                 ^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 1187, in _connection_for_bind
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     conn = bind.connect()
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3277, in connect
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     return self._connection_cls(self)
апр 15 22:13:43 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:43 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 143, in __init__
апр 15 22:13:43 vm2512296768 uvicorn[41263]:     self._dbapi_connection = engine.raw_connection()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                              ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3301, in raw_connection
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.pool.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 447, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return _ConnectionFairy._checkout(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 1264, in _checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     fairy = _ConnectionRecord.checkout(pool)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 711, in checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     rec = pool._do_get()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:           ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/impl.py", line 166, in _do_get
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc.TimeoutError(
апр 15 22:13:44 vm2512296768 uvicorn[41263]: sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00 (Background on this error at: https://sqlalche.me/e/20/3o7r)
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-VSCkNsbPfcb9M3lVQWllOA/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-t_fFZDfNsNZXy4Ly1fUQYA/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     connection closed
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-6S9Z2uucObRWpoNnwcl2bA/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ❌ ERROR: 502: Ошибка авторизации Avito: Server disconnected without sending a response.
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-Mf8Rmgh0_NgdpNRIqqUmwQ/product-link HTTP/1.0" 500 Internal Server Error
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ERROR:    Exception in ASGI application
апр 15 22:13:44 vm2512296768 uvicorn[41263]: Traceback (most recent call last):
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/protocols/http/httptools_impl.py", line 409, in run_asgi
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result = await app(  # type: ignore[func-returns-value]
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/applications.py", line 1134, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await super().__call__(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/applications.py", line 113, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, _send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 191, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     with recv_stream, send_stream, collapse_excgroups():
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self.gen.throw(value)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_utils.py", line 85, in collapse_excgroups
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 193, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await self.dispatch_func(request, call_next)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 100, in handle_large_files
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise e
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 92, in handle_large_files
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await call_next(request)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 168, in call_next
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise app_exc from app_exc.__cause__ or app_exc.__context__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 144, in coro
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive_or_disconnect, send_no_error)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 85, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await route.handle(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 125, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 111, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await f(request)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 391, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raw_response = await run_endpoint_function(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 290, in run_endpoint_function
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await dependant.call(**values)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/routers/avito_messenger.py", line 101, in get_avito_chat_product_link
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     if not current_user.organization_id:
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/attributes.py", line 569, in __get__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.impl.get(state, dict_)  # type: ignore[no-any-return]
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/attributes.py", line 1096, in get
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     value = self._fire_loader_callables(state, key, passive)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/attributes.py", line 1126, in _fire_loader_callables
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return state._load_expired(state, passive)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/state.py", line 803, in _load_expired
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self.manager.expired_attribute_loader(self, toload, passive)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 1674, in load_scalar_attributes
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result = load_on_ident(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 510, in load_on_ident
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return load_on_pk_identity(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 695, in load_on_pk_identity
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     session.execute(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2351, in execute
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self._execute_internal(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2239, in _execute_internal
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     conn = self._connection_for_bind(bind)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2108, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return trans._connection_for_bind(engine, execution_options)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "<string>", line 2, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/state_changes.py", line 137, in _go
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     ret_value = fn(self, *arg, **kw)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                 ^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 1187, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     conn = bind.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3277, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self._connection_cls(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 143, in __init__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self._dbapi_connection = engine.raw_connection()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                              ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3301, in raw_connection
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.pool.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 447, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return _ConnectionFairy._checkout(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 1264, in _checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     fairy = _ConnectionRecord.checkout(pool)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 711, in checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     rec = pool._do_get()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:           ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/impl.py", line 166, in _do_get
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc.TimeoutError(
апр 15 22:13:44 vm2512296768 uvicorn[41263]: sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00 (Background on this error at: https://sqlalche.me/e/20/3o7r)
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-~SfjvBaw4nZt9DD~dkyXaA/product-link HTTP/1.0" 500 Internal Server Error
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ERROR:    Exception in ASGI application
апр 15 22:13:44 vm2512296768 uvicorn[41263]: Traceback (most recent call last):
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/protocols/http/httptools_impl.py", line 409, in run_asgi
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result = await app(  # type: ignore[func-returns-value]
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/applications.py", line 1134, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await super().__call__(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/applications.py", line 113, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, _send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 191, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     with recv_stream, send_stream, collapse_excgroups():
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self.gen.throw(value)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_utils.py", line 85, in collapse_excgroups
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 193, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await self.dispatch_func(request, call_next)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 100, in handle_large_files
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise e
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 92, in handle_large_files
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await call_next(request)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 168, in call_next
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise app_exc from app_exc.__cause__ or app_exc.__context__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 144, in coro
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive_or_disconnect, send_no_error)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 85, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await route.handle(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 125, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 111, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await f(request)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 381, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     solved_result = await solve_dependencies(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                     ^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/dependencies/utils.py", line 646, in solve_dependencies
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     solved = await run_in_threadpool(call, **solved_result.values)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/concurrency.py", line 38, in run_in_threadpool
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await anyio.to_thread.run_sync(func)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/to_thread.py", line 56, in run_sync
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await get_async_backend().run_sync_in_worker_thread(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/_backends/_asyncio.py", line 2485, in run_sync_in_worker_thread
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await future
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/_backends/_asyncio.py", line 976, in run
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result = context.run(func, *args)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/core/auth.py", line 83, in get_current_user
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     user = get_user_by_email(db, email)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/core/auth.py", line 49, in get_user_by_email
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return db.query(User).filter(User.email == email).first()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/query.py", line 2759, in first
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.limit(1)._iter().first()  # type: ignore
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/query.py", line 2857, in _iter
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result: Union[ScalarResult[_T], Result[_T]] = self.session.execute(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                                                   ^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2351, in execute
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self._execute_internal(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2239, in _execute_internal
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     conn = self._connection_for_bind(bind)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2108, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return trans._connection_for_bind(engine, execution_options)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "<string>", line 2, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/state_changes.py", line 137, in _go
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     ret_value = fn(self, *arg, **kw)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                 ^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 1187, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     conn = bind.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3277, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self._connection_cls(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 143, in __init__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self._dbapi_connection = engine.raw_connection()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                              ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3301, in raw_connection
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.pool.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 447, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return _ConnectionFairy._checkout(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 1264, in _checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     fairy = _ConnectionRecord.checkout(pool)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 711, in checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     rec = pool._do_get()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:           ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/impl.py", line 166, in _do_get
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc.TimeoutError(
апр 15 22:13:44 vm2512296768 uvicorn[41263]: sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00 (Background on this error at: https://sqlalche.me/e/20/3o7r)
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-qcq2nljuGXRCBkuz_5cOZw/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-dR0lDi5U5Xxa2Fhowfbw_g/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-1~IvVG_iDuXzkZLGKNo4BA/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-EKeiJ0_h0oo6R~0Uyz~lYQ/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-ds2GMA~Y73g3HC0uuij0tA/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-LcjZ4GjUfdi5prbEba3gfg/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-7qJixigskB6QXZsjt~VF9g/product-link HTTP/1.0" 200 OK
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     178.78.61.251:0 - "GET /api/avito/messenger/chats/u2i-FOa1aL3KHsb4AwK6EI5ffA/product-link HTTP/1.0" 500 Internal Server Error
апр 15 22:13:44 vm2512296768 uvicorn[41263]: ERROR:    Exception in ASGI application
апр 15 22:13:44 vm2512296768 uvicorn[41263]: Traceback (most recent call last):
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/protocols/http/httptools_impl.py", line 409, in run_asgi
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result = await app(  # type: ignore[func-returns-value]
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/applications.py", line 1134, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await super().__call__(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/applications.py", line 113, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, _send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 191, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     with recv_stream, send_stream, collapse_excgroups():
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self.gen.throw(value)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_utils.py", line 85, in collapse_excgroups
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 193, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await self.dispatch_func(request, call_next)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 100, in handle_large_files
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise e
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/main.py", line 92, in handle_large_files
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await call_next(request)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 168, in call_next
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise app_exc from app_exc.__cause__ or app_exc.__context__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 144, in coro
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive_or_disconnect, send_no_error)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 85, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.middleware_stack(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await route.handle(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await self.app(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 125, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     await app(scope, receive, sender)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 111, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     response = await f(request)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                ^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 381, in app
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     solved_result = await solve_dependencies(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                     ^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/dependencies/utils.py", line 646, in solve_dependencies
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     solved = await run_in_threadpool(call, **solved_result.values)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/concurrency.py", line 38, in run_in_threadpool
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await anyio.to_thread.run_sync(func)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/to_thread.py", line 56, in run_sync
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await get_async_backend().run_sync_in_worker_thread(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/_backends/_asyncio.py", line 2485, in run_sync_in_worker_thread
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return await future
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/_backends/_asyncio.py", line 976, in run
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result = context.run(func, *args)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:              ^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/core/auth.py", line 83, in get_current_user
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     user = get_user_by_email(db, email)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/app/core/auth.py", line 49, in get_user_by_email
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return db.query(User).filter(User.email == email).first()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/query.py", line 2759, in first
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.limit(1)._iter().first()  # type: ignore
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/query.py", line 2857, in _iter
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     result: Union[ScalarResult[_T], Result[_T]] = self.session.execute(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                                                   ^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2351, in execute
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self._execute_internal(
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2239, in _execute_internal
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     conn = self._connection_for_bind(bind)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2108, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return trans._connection_for_bind(engine, execution_options)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "<string>", line 2, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/state_changes.py", line 137, in _go
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     ret_value = fn(self, *arg, **kw)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                 ^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 1187, in _connection_for_bind
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     conn = bind.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3277, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self._connection_cls(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 143, in __init__
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     self._dbapi_connection = engine.raw_connection()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:                              ^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 3301, in raw_connection
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return self.pool.connect()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 447, in connect
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     return _ConnectionFairy._checkout(self)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 1264, in _checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     fairy = _ConnectionRecord.checkout(pool)
апр 15 22:13:44 vm2512296768 uvicorn[41263]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/base.py", line 711, in checkout
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     rec = pool._do_get()
апр 15 22:13:44 vm2512296768 uvicorn[41263]:           ^^^^^^^^^^^^^^
апр 15 22:13:44 vm2512296768 uvicorn[41263]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/pool/impl.py", line 166, in _do_get
апр 15 22:13:44 vm2512296768 uvicorn[41263]:     raise exc.TimeoutError(
апр 15 22:13:44 vm2512296768 uvicorn[41263]: sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00 (Background on this error at: https://sqlalche.me/e/20/3o7r)
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:     connection closed
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:httpx:HTTP Request: POST https://api.avito.ru/token "HTTP/1.1 200 OK"
апр 15 22:13:44 vm2512296768 uvicorn[41263]: INFO:httpx:HTTP Request: POST https://api.avito.ru/token "HTTP/1.1 200 OK"

