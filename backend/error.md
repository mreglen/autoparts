мар 15 21:13:46 vm2512296768 uvicorn[237130]: === PHOTO UPLOAD REQUEST ===
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Filename: TVgpq7hgzd_20260307_104325_4f1053c8.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Content-Type: image/webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]: ✓ Watermark will be applied (user is admin)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   Logo path from DB: /uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   Logo relative path: uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   Logo file path: uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   Logo exists: False
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Generated filename: TVgpq7hgzd_20260315_211346_aafe4f7c.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Saved original photo to temp: /home/fast/autoparts/backend/uploads/temp/15374fb5101945d5a672f2b2ab47aa0a.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Absolute temp path: /home/fast/autoparts/backend/uploads/temp/15374fb5101945d5a672f2b2ab47aa0a.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Processing photo with Celery. Temp path: /home/fast/autoparts/backend/uploads/temp/15374fb5101945d5a672f2b2ab47aa0a.webp, Organization: TVgpq7hgzd
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Final filename will be: TVgpq7hgzd_20260315_211346_aafe4f7c.webp
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Error processing photo: Authentication required.
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Full traceback: Traceback (most recent call last):
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/functional.py", line 32, in __call__
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return self.__value__
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]: AttributeError: 'ChannelPromise' object has no attribute '__value__'. Did you mean: '__call__'?
мар 15 21:13:46 vm2512296768 uvicorn[237130]: During handling of the above exception, another exception occurred:
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Traceback (most recent call last):
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/transport/virtual/base.py", line 951, in create_channel
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return self._avail_channels.pop()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]: IndexError: pop from empty list
мар 15 21:13:46 vm2512296768 uvicorn[237130]: During handling of the above exception, another exception occurred:
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Traceback (most recent call last):
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 474, in _reraise_as_library_errors
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     yield
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 461, in _ensure_connection
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return retry_over_time(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/functional.py", line 318, in retry_over_time
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return fun(*args, **kwargs)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 941, in _connection_factory
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     self._connection = self._establish_connection()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 863, in _establish_connection
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     conn = self.transport.establish_connection()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/transport/virtual/base.py", line 975, in establish_connection
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     self._avail_channels.append(self.create_channel(self))
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                                 ^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/transport/virtual/base.py", line 953, in create_channel
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     channel = self.Channel(connection)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:               ^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/transport/redis.py", line 757, in __init__
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     self.client.ping()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/commands/core.py", line 1250, in ping
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return self.execute_command("PING", **kwargs)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/client.py", line 716, in execute_command
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return self._execute_command(*args, **options)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/client.py", line 736, in _execute_command
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     result = conn.retry.call_with_retry(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/retry.py", line 132, in call_with_retry
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     raise error
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/retry.py", line 120, in call_with_retry
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return do()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/client.py", line 737, in <lambda>
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     lambda: self._send_command_parse_response(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/client.py", line 682, in _send_command_parse_response
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return self.parse_response(conn, command_name, **options)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/client.py", line 780, in parse_response
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     response = connection.read_response()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/connection.py", line 1341, in read_response
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     response = self._parser.read_response(disable_decoding=disable_decoding)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/_parsers/resp2.py", line 15, in read_response
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     result = self._read_response(disable_decoding=disable_decoding)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/redis/_parsers/resp2.py", line 38, in _read_response
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     raise error
мар 15 21:13:46 vm2512296768 uvicorn[237130]: redis.exceptions.AuthenticationError: Authentication required.
мар 15 21:13:46 vm2512296768 uvicorn[237130]: The above exception was the direct cause of the following exception:
мар 15 21:13:46 vm2512296768 uvicorn[237130]: Traceback (most recent call last):
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/app/routers/upload.py", line 139, in upload_photo
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     task = process_and_upload_photo.delay(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/task.py", line 444, in delay
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return self.apply_async(args, kwargs)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/task.py", line 608, in apply_async
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return app.send_task(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/base.py", line 947, in send_task
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     amqp.send_task_message(P, name, message, **options)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/amqp.py", line 559, in send_task_message
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     ret = producer.publish(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:           ^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/messaging.py", line 190, in publish
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return _publish(
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 558, in _ensured
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     return fun(*args, **kwargs)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:            ^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/messaging.py", line 200, in _publish
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     channel = self.channel
мар 15 21:13:46 vm2512296768 uvicorn[237130]:               ^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/messaging.py", line 224, in _get_channel
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     channel = self._channel = channel()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                               ^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/functional.py", line 34, in __call__
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     value = self.__value__ = self.__contract__()
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                              ^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/messaging.py", line 240, in <lambda>
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     channel = ChannelPromise(lambda: connection.default_channel)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 960, in default_channel
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     self._ensure_connection(**conn_opts)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 460, in _ensure_connection
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     with ctx():
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     self.gen.throw(value)
мар 15 21:13:46 vm2512296768 uvicorn[237130]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/connection.py", line 478, in _reraise_as_library_errors
мар 15 21:13:46 vm2512296768 uvicorn[237130]:     raise ConnectionError(str(exc)) from exc
мар 15 21:13:46 vm2512296768 uvicorn[237130]: kombu.exceptions.OperationalError: Authentication required.
мар 15 21:13:46 vm2512296768 uvicorn[237130]: INFO:     178.211.167.147:0 - "POST /api/upload/photo?organization_id=TVgpq7hgzd HTTP/1.0" 500 Internal Server Error



