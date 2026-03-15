мар 15 21:18:19 vm2512296768 uvicorn[237494]: === ORGANIZATION LOGO UPLOAD REQUEST ===
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Filename: LogoWithoutBg.png
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Content-Type: image/png
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Generated filename: TVgpq7hgzd_20260315_211818_ca18a583.png
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Saved original logo to temp: /home/fast/autoparts/backend/uploads/temp/d15e5e890546445fbb4368bb3a8f5666.png
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Absolute temp path: /home/fast/autoparts/backend/uploads/temp/d15e5e890546445fbb4368bb3a8f5666.png
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Processing logo with Celery. Temp path: /home/fast/autoparts/backend/uploads/temp/d15e5e890546445fbb4368bb3a8f5666.png, Organization: TVgpq7hgzd
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Final filename will be: TVgpq7hgzd_20260315_211818_ca18a583.png
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Celery task queued: dd221f24-1e3d-41ed-9861-c3d5fa302da1
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Waiting for Celery task dd221f24-1e3d-41ed-9861-c3d5fa302da1 to complete...
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Getting result from task dd221f24-1e3d-41ed-9861-c3d5fa302da1...
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Error processing logo: process_and_upload_photo() got an unexpected keyword argument 'subfolder'
мар 15 21:18:19 vm2512296768 uvicorn[237494]: Full traceback: Traceback (most recent call last):
мар 15 21:18:19 vm2512296768 uvicorn[237494]:   File "/home/fast/autoparts/backend/app/routers/upload.py", line 712, in upload_organization_logo
мар 15 21:18:19 vm2512296768 uvicorn[237494]:     result_data = task.get(timeout=5)
мар 15 21:18:19 vm2512296768 uvicorn[237494]:                   ^^^^^^^^^^^^^^^^^^^
мар 15 21:18:19 vm2512296768 uvicorn[237494]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/result.py", line 249, in get
мар 15 21:18:19 vm2512296768 uvicorn[237494]:     self.maybe_throw(callback=callback)
мар 15 21:18:19 vm2512296768 uvicorn[237494]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/result.py", line 367, in maybe_throw
мар 15 21:18:19 vm2512296768 uvicorn[237494]:     self.throw(value, self._to_remote_traceback(tb))
мар 15 21:18:19 vm2512296768 uvicorn[237494]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/celery/result.py", line 360, in throw
мар 15 21:18:19 vm2512296768 uvicorn[237494]:     self.on_ready.throw(*args, **kwargs)
мар 15 21:18:19 vm2512296768 uvicorn[237494]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/vine/promises.py", line 235, in throw
мар 15 21:18:19 vm2512296768 uvicorn[237494]:     reraise(type(exc), exc, tb)
мар 15 21:18:19 vm2512296768 uvicorn[237494]:   File "/home/fast/autoparts/backend/venv/lib/python3.12/site-packages/vine/utils.py", line 27, in reraise
мар 15 21:18:19 vm2512296768 uvicorn[237494]:     raise value
мар 15 21:18:19 vm2512296768 uvicorn[237494]: TypeError: process_and_upload_photo() got an unexpected keyword argument 'subfolder'
мар 15 21:18:19 vm2512296768 uvicorn[237494]: INFO:     178.211.167.147:0 - "POST /api/upload/organization-logo HTTP/1.0" 500 Internal Server Error
мар 15 21:18:20 vm2512296768 uvicorn[237494]: INFO:     178.211.167.147:0 - "GET /uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp HTTP/1.0" 404 Not Found

apiClient.js:123  POST https://svoygarage.ru/server/api/upload/organization-logo 500 (Internal Server Error)
ls @ apiClient.js:123
(anonymous) @ OrganizationSlice.js:27
(anonymous) @ createAsyncThunk.ts:363
(anonymous) @ createAsyncThunk.ts:328
(anonymous) @ redux-thunk.mjs:5
(anonymous) @ OrganizationInfoSection.jsx:45
y @ OrganizationInfoSection.jsx:81
Jd @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
Wt @ react-dom-client.production.js:1498
tu @ react-dom-client.production.js:12455
wm @ react-dom-client.production.js:15306
bm @ react-dom-client.production.js:15274
installHook.js:1 apiRequestFormData - Error: {detail: "Ошибка при обработке фото: process_and_upload_photo() got an unexpected keyword argument 'subfolder'"}
overrideMethod @ installHook.js:1
ls @ apiClient.js:130
await in ls
(anonymous) @ OrganizationSlice.js:27
(anonymous) @ createAsyncThunk.ts:363
(anonymous) @ createAsyncThunk.ts:328
(anonymous) @ redux-thunk.mjs:5
(anonymous) @ OrganizationInfoSection.jsx:45
y @ OrganizationInfoSection.jsx:81
Jd @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
Wt @ react-dom-client.production.js:1498
tu @ react-dom-client.production.js:12455
wm @ react-dom-client.production.js:15306
bm @ react-dom-client.production.js:15274
installHook.js:1 Organization logo upload error: Error: Ошибка при обработке фото: process_and_upload_photo() got an unexpected keyword argument 'subfolder'
    at ls (apiClient.js:131:15)
    at async OrganizationSlice.js:27:19
    at async createAsyncThunk.ts:363:13
    at async OrganizationInfoSection.jsx:45:13
    at async y (OrganizationInfoSection.jsx:81:13)
overrideMethod @ installHook.js:1
(anonymous) @ OrganizationSlice.js:32
await in (anonymous)
(anonymous) @ createAsyncThunk.ts:363
(anonymous) @ createAsyncThunk.ts:328
(anonymous) @ redux-thunk.mjs:5
(anonymous) @ OrganizationInfoSection.jsx:45
y @ OrganizationInfoSection.jsx:81
Jd @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
Wt @ react-dom-client.production.js:1498
tu @ react-dom-client.production.js:12455
wm @ react-dom-client.production.js:15306
bm @ react-dom-client.production.js:15274
installHook.js:1 Error uploading logo: Ошибка при обработке фото: process_and_upload_photo() got an unexpected keyword argument 'subfolder'
overrideMethod @ installHook.js:1
(anonymous) @ OrganizationInfoSection.jsx:55
await in (anonymous)
y @ OrganizationInfoSection.jsx:81
Jd @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
Wt @ react-dom-client.production.js:1498
tu @ react-dom-client.production.js:12455
wm @ react-dom-client.production.js:15306
bm @ react-dom-client.production.js:15274
OrganizationInfoSection.jsx:100 Uncaught (in promise) Ошибка при обработке фото: process_and_upload_photo() got an unexpected keyword argument 'subfolder'
y @ OrganizationInfoSection.jsx:100
await in y
Jd @ react-dom-client.production.js:12317
(anonymous) @ react-dom-client.production.js:12867
Wt @ react-dom-client.production.js:1498
tu @ react-dom-client.production.js:12455
wm @ react-dom-client.production.js:15306
bm @ react-dom-client.production.js:15274
TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp:1  GET https://svoygarage.ru/server/uploads/logo_organizations/TVgpq7hgzd/TVgpq7hgzd_20260315_142711_TVgpq7hgzd_20260315_142707_9737a605.webp 404 (Not Found)