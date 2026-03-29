(venv) root@vm2512296768:/home/fast/autoparts# sudo service kroan restart
sudo systemctl status kroan
sudo journalctl -u kroan.service -f
Warning: The unit file, source configuration file or drop-ins of kroan.service changed on disk. Run 'systemctl daemon-reload' to reload units.
Warning: The unit file, source configuration file or drop-ins of kroan.service changed on disk. Run 'systemctl daemo>
● kroan.service - FastAPI project
     Loaded: loaded (/etc/systemd/system/kroan.service; enabled; preset: enabled)
     Active: active (running) since Sun 2026-03-29 16:02:48 MSK; 25ms ago
   Main PID: 135823 (uvicorn)
      Tasks: 1 (limit: 4620)
     Memory: 2.6M (peak: 2.6M)
        CPU: 15ms
     CGroup: /system.slice/kroan.service
             └─135823 /home/fast/autoparts/backend/venv/bin/python3 /home/fast/autoparts/backend/venv/bin/uvicorn ap>

мар 29 16:02:48 vm2512296768 systemd[1]: Started kroan.service - FastAPI project.

мар 29 16:02:48 vm2512296768 systemd[1]: Started kroan.service - FastAPI project.
мар 29 16:02:48 vm2512296768 uvicorn[135823]: INFO:     Will watch for changes in these directories: ['/home/fast/autoparts/backend']
мар 29 16:02:48 vm2512296768 uvicorn[135823]: INFO:     Uvicorn running on http://127.0.0.1:8080 (Press CTRL+C to quit)
мар 29 16:02:48 vm2512296768 uvicorn[135823]: INFO:     Started reloader process [135823] using WatchFiles
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:     Started server process [135831]
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:     Waiting for application startup.
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:apscheduler.scheduler:Adding job tentatively -- it will be properly scheduled when the scheduler starts
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:apscheduler.scheduler:Added job "Clean up expired user sessions every hour" to job store "default"
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:apscheduler.scheduler:Scheduler started
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:app.main:Scheduler started. Expired session cleanup job scheduled.
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:app.main:Все организации с методами доставки настроены
мар 29 16:02:51 vm2512296768 uvicorn[135831]: INFO:     Application startup complete.
мар 29 16:02:55 vm2512296768 uvicorn[135831]: INFO:     178.78.61.251:0 - "WebSocket /api/printers/ws" [accepted]
мар 29 16:02:55 vm2512296768 uvicorn[135831]: INFO:     connection open
мар 29 16:03:01 vm2512296768 uvicorn[135831]: INFO:     178.78.61.251:0 - "POST /api/printers/id/1/print-test-label HTTP/1.1" 500 Internal Server Error
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ERROR:    Exception in ASGI application
мар 29 16:03:01 vm2512296768 uvicorn[135831]: Traceback (most recent call last):
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/protocols/http/httptools_impl.py", line 409, in run_asgi
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     result = await app(  # type: ignore[func-returns-value]
мар 29 16:03:01 vm2512296768 uvicorn[135831]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     return await self.app(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/applications.py", line 1134, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await super().__call__(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/applications.py", line 113, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.middleware_stack(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise exc
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.app(scope, receive, _send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 191, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     with recv_stream, send_stream, collapse_excgroups():
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     self.gen.throw(value)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_utils.py", line 85, in collapse_excgroups
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise exc
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 193, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     response = await self.dispatch_func(request, call_next)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/app/main.py", line 64, in handle_large_files
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise e
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/app/main.py", line 56, in handle_large_files
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     response = await call_next(request)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:                ^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 168, in call_next
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise app_exc from app_exc.__cause__ or app_exc.__context__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/base.py", line 144, in coro
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.app(scope, receive_or_disconnect, send_no_error)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 93, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.simple_response(scope, receive, send, request_headers=headers)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 144, in simple_response
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.app(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise exc
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await app(scope, receive, sender)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.app(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.middleware_stack(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await route.handle(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self.app(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 125, in app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise exc
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await app(scope, receive, sender)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 111, in app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     response = await f(request)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:                ^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 391, in app
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raw_response = await run_endpoint_function(
мар 29 16:03:01 vm2512296768 uvicorn[135831]:                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/fastapi/routing.py", line 290, in run_endpoint_function
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     return await dependant.call(**values)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/app/routers/printers.py", line 388, in print_test_label
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     pdf_bytes = _html_to_pdf_bytes(html, width_mm=width_mm, height_mm=height_mm)
мар 29 16:03:01 vm2512296768 uvicorn[135831]:                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/app/routers/printers.py", line 60, in _html_to_pdf_bytes
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise RuntimeError(f"PDF renderer failed: {proc.stderr or proc.stdout or 'unknown error'}")
мар 29 16:03:01 vm2512296768 uvicorn[135831]: RuntimeError: PDF renderer failed: Traceback (most recent call last):
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/app/utils/render_label_pdf.py", line 39, in <module>
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise SystemExit(main())
мар 29 16:03:01 vm2512296768 uvicorn[135831]:                      ^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/app/utils/render_label_pdf.py", line 22, in main
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     browser = p.chromium.launch()
мар 29 16:03:01 vm2512296768 uvicorn[135831]:               ^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/playwright/sync_api/_generated.py", line 14566, in launch
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     self._sync(
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/playwright/_impl/_sync_base.py", line 115, in _sync
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     return task.result()
мар 29 16:03:01 vm2512296768 uvicorn[135831]:            ^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/playwright/_impl/_browser_type.py", line 97, in launch
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     await self._channel.send(
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/playwright/_impl/_connection.py", line 69, in send
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     return await self._connection.wrap_api_call(
мар 29 16:03:01 vm2512296768 uvicorn[135831]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 29 16:03:01 vm2512296768 uvicorn[135831]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/playwright/_impl/_connection.py", line 559, in wrap_api_call
мар 29 16:03:01 vm2512296768 uvicorn[135831]:     raise rewrite_error(error, f"{parsed_st['apiName']}: {error}") from None
мар 29 16:03:01 vm2512296768 uvicorn[135831]: playwright._impl._errors.Error: BrowserType.launch: Executable doesn't exist at /home/fast/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ╔════════════════════════════════════════════════════════════╗
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ║ Looks like Playwright was just installed or updated.       ║
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ║ Please run the following command to download new browsers: ║
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ║                                                            ║
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ║     playwright install                                     ║
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ║                                                            ║
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ║ <3 Playwright Team                                         ║
мар 29 16:03:01 vm2512296768 uvicorn[135831]: ╚════════════════════════════════════════════════════════════╝
^C
(venv) root@vm2512296768:/home/fast/autoparts# ^C
(venv) root@vm2512296768:/home/fast/autoparts#
