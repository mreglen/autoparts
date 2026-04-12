INFO:     127.0.0.1:57803 - "GET /api/organizations/qMHbBIoD51/avito/credentials HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
Traceback (most recent call last):
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
    ~~~~~~~~~~~~~~~~~~~~~~~^
        cursor, str_statement, effective_parameters, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\default.py", line 951, in do_execute
    cursor.execute(statement, parameters)
    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
psycopg2.errors.UndefinedColumn: ОШИБКА:  столбец organization_avito_autoload_cache.warnings_json не существует
LINE 1: ...anization_avito_autoload_cache_avito_token_error, organizati...
                                                             ^


The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\uvicorn\protocols\http\httptools_impl.py", line 409, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\uvicorn\middleware\proxy_headers.py", line 60, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\fastapi\applications.py", line 1134, in __call__
    await super().__call__(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\applications.py", line 113, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\errors.py", line 186, in __call__
    raise exc
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\errors.py", line 164, in __call__
    await self.app(scope, receive, _send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\base.py", line 191, in __call__
    with recv_stream, send_stream, collapse_excgroups():
                                   ~~~~~~~~~~~~~~~~~~^^
  File "C:\Users\khram\AppData\Local\Python\pythoncore-3.14-64\Lib\contextlib.py", line 162, in __exit__
    self.gen.throw(value)
    ~~~~~~~~~~~~~~^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\_utils.py", line 85, in collapse_excgroups
    raise exc
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\base.py", line 193, in __call__
    response = await self.dispatch_func(request, call_next)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\main.py", line 100, in handle_large_files
    raise e
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\main.py", line 92, in handle_large_files
    response = await call_next(request)
               ^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\base.py", line 168, in call_next
    raise app_exc from app_exc.__cause__ or app_exc.__context__
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\base.py", line 144, in coro
    await self.app(scope, receive_or_disconnect, send_no_error)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\cors.py", line 93, in __call__
    await self.simple_response(scope, receive, send, request_headers=headers)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\cors.py", line 144, in simple_response
    await self.app(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\middleware\exceptions.py", line 63, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\fastapi\middleware\asyncexitstack.py", line 18, in __call__
    await self.app(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\routing.py", line 716, in __call__
    await self.middleware_stack(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\routing.py", line 736, in app
    await route.handle(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\routing.py", line 290, in handle
    await self.app(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\fastapi\routing.py", line 125, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\fastapi\routing.py", line 111, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\fastapi\routing.py", line 391, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\fastapi\routing.py", line 292, in run_endpoint_function
    return await run_in_threadpool(dependant.call, **values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\starlette\concurrency.py", line 38, in run_in_threadpool
    return await anyio.to_thread.run_sync(func)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\anyio\to_thread.py", line 56, in run_sync
    return await get_async_backend().run_sync_in_worker_thread(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        func, args, abandon_on_cancel=abandon_on_cancel, limiter=limiter
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\anyio\_backends\_asyncio.py", line 2485, in run_sync_in_worker_thread
    return await future
           ^^^^^^^^^^^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\anyio\_backends\_asyncio.py", line 976, in run
    result = context.run(func, *args)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\routers\avito_integration.py", line 362, in get_avito_credentials
    last = _get_last_autoload(db, org_id)
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\routers\avito_integration.py", line 144, in _get_last_autoload
    .first()
     ~~~~~^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\orm\query.py", line 2759, in first
    return self.limit(1)._iter().first()  # type: ignore
           ~~~~~~~~~~~~~~~~~~~^^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\orm\query.py", line 2857, in _iter
    result: Union[ScalarResult[_T], Result[_T]] = self.session.execute(
                                                  ~~~~~~~~~~~~~~~~~~~~^
        statement,
        ^^^^^^^^^^
        params,
        ^^^^^^^
        execution_options={"_sa_orm_load_options": self.load_options},
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\orm\session.py", line 2351, in execute
    return self._execute_internal(
           ~~~~~~~~~~~~~~~~~~~~~~^
        statement,
        ^^^^^^^^^^
    ...<4 lines>...
        _add_event=_add_event,
        ^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\orm\session.py", line 2249, in _execute_internal
    result: Result[Any] = compile_state_cls.orm_execute_statement(
                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        self,
        ^^^^^
    ...<4 lines>...
        conn,
        ^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\orm\context.py", line 306, in orm_execute_statement
    result = conn.execute(
        statement, params or {}, execution_options=execution_options
    )
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 1419, in execute
    return meth(
        self,
        distilled_parameters,
        execution_options or NO_OPTIONS,
    )
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\sql\elements.py", line 526, in _execute_on_connection
    return connection._execute_clauseelement(
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        self, distilled_params, execution_options
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 1641, in _execute_clauseelement
    ret = self._execute_context(
        dialect,
    ...<8 lines>...
        cache_hit=cache_hit,
    )
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 1846, in _execute_context
    return self._exec_single_context(
           ~~~~~~~~~~~~~~~~~~~~~~~~~^
        dialect, context, statement, parameters
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 1986, in _exec_single_context
    self._handle_dbapi_exception(
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        e, str_statement, effective_parameters, cursor, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 2355, in _handle_dbapi_exception
    raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\base.py", line 1967, in _exec_single_context
    self.dialect.do_execute(
    ~~~~~~~~~~~~~~~~~~~~~~~^
        cursor, str_statement, effective_parameters, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\.venv\Lib\site-packages\sqlalchemy\engine\default.py", line 951, in do_execute
    cursor.execute(statement, parameters)
    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn) ОШИБКА:  столбец organization_avito_autoload_cache.warnings_json не существует
LINE 1: ...anization_avito_autoload_cache_avito_token_error, organizati...
                                                             ^

[SQL: SELECT organization_avito_autoload_cache.organization_id AS organization_avito_autoload_cache_organization_id, organization_avito_autoload_cache.items_json AS organization_avito_autoload_cache_items_json, organization_avito_autoload_cache.saved_path AS organization_avito_autoload_cache_saved_path, organization_avito_autoload_cache.local_validation_ok AS organization_avito_autoload_cache_local_validation_ok, organization_avito_autoload_cache.local_errors_json AS organization_avito_autoload_cache_local_errors_json, organization_avito_autoload_cache.sheets_parsed_json AS organization_avito_autoload_cache_sheets_parsed_json, organization_avito_autoload_cache.avito_upload_json AS organization_avito_autoload_cache_avito_upload_json, organization_avito_autoload_cache.avito_upload_status AS organization_avito_autoload_cache_avito_upload_status, organization_avito_autoload_cache.avito_report_json AS organization_avito_autoload_cache_avito_report_json, organization_avito_autoload_cache.avito_token_error AS organization_avito_autoload_cache_avito_token_error, organization_avito_autoload_cache.warnings_json AS organization_avito_autoload_cache_warnings_json, organization_avito_autoload_cache.updated_at AS organization_avito_autoload_cache_updated_at
FROM organization_avito_autoload_cache
WHERE organization_avito_autoload_cache.organization_id = %(organization_id_1)s
 LIMIT %(param_1)s]
[parameters: {'organization_id_1': 'qMHbBIoD51', 'param_1': 1}]
(Background on this error at: https://sqlalche.me/e/20/f405)
