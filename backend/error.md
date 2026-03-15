мар 15 17:42:50 vm2512296768 uvicorn[233157]: === PHOTO UPLOAD REQUEST ===
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Filename: orig-1.png
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Content-Type: image/png
мар 15 17:42:50 vm2512296768 uvicorn[233157]: ✓ Watermark will be applied (user is admin)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   Logo path from DB: /uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   Logo relative path: uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   Logo file path: uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   Logo exists: True
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Generated filename: TVgpq7hgzd_20260315_174250_30b19fe5.png
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Saved original photo to temp: uploads/temp/885f9f3c11874c5bb3f9312087e43aa9.png
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Absolute temp path: /home/fast/autoparts/backend/uploads/temp/885f9f3c11874c5bb3f9312087e43aa9.png
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Processing photo with Celery. Temp path: uploads/temp/885f9f3c11874c5bb3f9312087e43aa9.png, Organization: TVgpq7hgzd
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Final filename will be: TVgpq7hgzd_20260315_174250_30b19fe5.png
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Error processing photo: Object of type PosixPath is not JSON serializable
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Full traceback: Traceback (most recent call last):
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/serialization.py", line 41, in _reraise_errors
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     yield
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/serialization.py", line 220, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     payload = encoder(data)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:               ^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/json.py", line 63, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return _dumps(s, cls=cls, **dict(default_kwargs, **kwargs))
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/__init__.py", line 238, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     **kw).encode(obj)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:           ^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/encoder.py", line 200, in encode
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     chunks = self.iterencode(o, _one_shot=True)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/encoder.py", line 258, in iterencode
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return _iterencode(o, 0)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/json.py", line 47, in default
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return super().default(o)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/encoder.py", line 180, in default
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     raise TypeError(f'Object of type {o.__class__.__name__} '
мар 15 17:42:50 vm2512296768 uvicorn[233157]: TypeError: Object of type PosixPath is not JSON serializable
мар 15 17:42:50 vm2512296768 uvicorn[233157]: During handling of the above exception, another exception occurred:
мар 15 17:42:50 vm2512296768 uvicorn[233157]: Traceback (most recent call last):
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/app/routers/upload.py", line 141, in upload_photo
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     task = process_and_upload_photo.delay(
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/task.py", line 444, in delay
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return self.apply_async(args, kwargs)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/task.py", line 608, in apply_async
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return app.send_task(
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/base.py", line 947, in send_task
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     amqp.send_task_message(P, name, message, **options)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/app/amqp.py", line 559, in send_task_message
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     ret = producer.publish(
мар 15 17:42:50 vm2512296768 uvicorn[233157]:           ^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/messaging.py", line 178, in publish
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     body, content_type, content_encoding = self._prepare(
мар 15 17:42:50 vm2512296768 uvicorn[233157]:                                            ^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/messaging.py", line 280, in _prepare
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     body) = dumps(body, serializer=serializer)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/serialization.py", line 219, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     with _reraise_errors(EncodeError):
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/contextlib.py", line 158, in __exit__
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     self.gen.throw(value)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/serialization.py", line 45, in _reraise_errors
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     reraise(wrapper, wrapper(exc), sys.exc_info()[2])
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/exceptions.py", line 34, in reraise
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     raise value.with_traceback(tb)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/serialization.py", line 41, in _reraise_errors
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     yield
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/serialization.py", line 220, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     payload = encoder(data)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:               ^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/json.py", line 63, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return _dumps(s, cls=cls, **dict(default_kwargs, **kwargs))
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/__init__.py", line 238, in dumps
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     **kw).encode(obj)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:           ^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/encoder.py", line 200, in encode
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     chunks = self.iterencode(o, _one_shot=True)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/encoder.py", line 258, in iterencode
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return _iterencode(o, 0)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/kombu/utils/json.py", line 47, in default
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     return super().default(o)
мар 15 17:42:50 vm2512296768 uvicorn[233157]:            ^^^^^^^^^^^^^^^^^^
мар 15 17:42:50 vm2512296768 uvicorn[233157]:   File "/usr/lib/python3.12/json/encoder.py", line 180, in default
мар 15 17:42:50 vm2512296768 uvicorn[233157]:     raise TypeError(f'Object of type {o.__class__.__name__} '
мар 15 17:42:50 vm2512296768 uvicorn[233157]: kombu.exceptions.EncodeError: Object of type PosixPath is not JSON serializable
мар 15 17:42:50 vm2512296768 uvicorn[233157]: INFO:     157.173.22.183:0 - "POST /api/upload/photo?organization_id=TVgpq7hgzd HTTP/1.0" 500 Internal Server Error

