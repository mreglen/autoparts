мар 17 18:16:40 vm2512296768 uvicorn[15969]: INFO:     178.78.61.251:0 - "GET /api/products/ HTTP/1.0" 500 Internal Server Error
мар 17 18:16:40 vm2512296768 uvicorn[15969]: ERROR:    Exception in ASGI application
мар 17 18:16:40 vm2512296768 uvicorn[15969]: Traceback (most recent call last):
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     self.dialect.do_execute(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/default.py", line 951, in do_execute
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     cursor.execute(statement, parameters)
мар 17 18:16:40 vm2512296768 uvicorn[15969]: psycopg2.errors.UndefinedColumn: column product_videos.created_at does not exist
мар 17 18:16:40 vm2512296768 uvicorn[15969]: LINE 1: ...ssing_status AS product_videos_processing_status, product_vi...
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                                                              ^
мар 17 18:16:40 vm2512296768 uvicorn[15969]: The above exception was the direct cause of the following exception:
мар 17 18:16:40 vm2512296768 uvicorn[15969]: Traceback (most recent call last):
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/protocols/http/h11_impl.py", line 403, in run_asgi
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     result = await app(  # type: ignore[func-returns-value]
мар 17 18:16:40 vm2512296768 uvicorn[15969]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return await self.app(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/applications.py", line 1134, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await super().__call__(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/applications.py", line 113, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.middleware_stack(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise exc
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.app(scope, receive, _send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 191, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     with recv_stream, send_stream, collapse_excgroups():
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     self.gen.throw(value)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_utils.py", line 85, in collapse_excgroups
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise exc
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 193, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     response = await self.dispatch_func(request, call_next)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/app/main.py", line 55, in handle_large_files
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise e
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/app/main.py", line 47, in handle_large_files
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     response = await call_next(request)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                ^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 168, in call_next
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise app_exc from app_exc.__cause__ or app_exc.__context__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 144, in coro
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.app(scope, receive_or_disconnect, send_no_error)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 85, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.app(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise exc
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await app(scope, receive, sender)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.app(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.middleware_stack(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await route.handle(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await self.app(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 125, in app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise exc
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     await app(scope, receive, sender)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 111, in app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     response = await f(request)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                ^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 391, in app
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raw_response = await run_endpoint_function(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 292, in run_endpoint_function
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return await run_in_threadpool(dependant.call, **values)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/concurrency.py", line 38, in run_in_threadpool
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return await anyio.to_thread.run_sync(func)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/to_thread.py", line 56, in run_sync
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return await get_async_backend().run_sync_in_worker_thread(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/_backends/_asyncio.py", line 2485, in run_sync_in_worker_thread
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return await future
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/anyio/_backends/_asyncio.py", line 976, in run
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     result = context.run(func, *args)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:              ^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/app/routers/products.py", line 701, in get_products
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     products = query.all()
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                ^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/query.py", line 2704, in all
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return self._iter().all()  # type: ignore
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/result.py", line 1774, in all
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return self._allrows()
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/result.py", line 548, in _allrows
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     rows = self._fetchall_impl()
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/result.py", line 1681, in _fetchall_impl
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return self._real_result._fetchall_impl()
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/result.py", line 2275, in _fetchall_impl
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return list(self.iterator)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 247, in chunks
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     post_load.invoke(context, path)
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/loading.py", line 1564, in invoke
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     loader(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/strategies.py", line 3338, in _load_for_path
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     self._load_via_parent(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/strategies.py", line 3414, in _load_via_parent
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     context.session.execute(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2351, in execute
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return self._execute_internal(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2249, in _execute_internal
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     result: Result[Any] = compile_state_cls.orm_execute_statement(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/orm/context.py", line 306, in orm_execute_statement
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     result = conn.execute(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:              ^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1419, in execute
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return meth(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/sql/elements.py", line 526, in _execute_on_connection
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return connection._execute_clauseelement(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1641, in _execute_clauseelement
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     ret = self._execute_context(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:           ^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1846, in _execute_context
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     return self._exec_single_context(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1986, in _exec_single_context
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     self._handle_dbapi_exception(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 2355, in _handle_dbapi_exception
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     self.dialect.do_execute(
мар 17 18:16:40 vm2512296768 uvicorn[15969]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/sqlalchemy/engine/default.py", line 951, in do_execute
мар 17 18:16:40 vm2512296768 uvicorn[15969]:     cursor.execute(statement, parameters)
мар 17 18:16:40 vm2512296768 uvicorn[15969]: sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn) column product_videos.created_at does not exist
мар 17 18:16:40 vm2512296768 uvicorn[15969]: LINE 1: ...ssing_status AS product_videos_processing_status, product_vi...
мар 17 18:16:40 vm2512296768 uvicorn[15969]:                                                              ^
мар 17 18:16:40 vm2512296768 uvicorn[15969]: [SQL: SELECT product_videos.product_id AS product_videos_product_id, product_videos.id AS product_videos_id, product_videos.video_url AS product_videos_video_url, product_videos.organization_id AS product_videos_organization_id, product_videos.processing_status AS product_videos_processing_status, product_videos.created_at AS product_videos_created_at, product_videos.updated_at AS product_videos_updated_at
мар 17 18:16:40 vm2512296768 uvicorn[15969]: FROM product_videos
мар 17 18:16:40 vm2512296768 uvicorn[15969]: WHERE product_videos.product_id IN (%(primary_keys_1)s, %(primary_keys_2)s, %(primary_keys_3)s, %(primary_keys_4)s, %(primary_keys_5)s, %(primary_keys_6)s, %(primary_keys_7)s, %(primary_keys_8)s, %(primary_keys_9)s, %(primary_keys_10)s, %(primary_keys_11)s, %(primary_keys_12)s, %(primary_keys_13)s, %(primary_keys_14)s)]
мар 17 18:16:40 vm2512296768 uvicorn[15969]: [parameters: {'primary_keys_1': 8, 'primary_keys_2': 9, 'primary_keys_3': 10, 'primary_keys_4': 11, 'primary_keys_5': 12, 'primary_keys_6': 13, 'primary_keys_7': 1, 'primary_keys_8': 3, 'primary_keys_9': 4, 'primary_keys_10': 5, 'primary_keys_11': 6, 'primary_keys_12': 7, 'primary_keys_13': 15, 'primary_keys_14': 25}]
мар 17 18:16:40 vm2512296768 uvicorn[15969]: (Background on this error at: https://sqlalche.me/e/20/f405)



