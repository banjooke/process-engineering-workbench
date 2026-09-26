# Production CORS diagnosis (2026-09-26)

The existing FastAPI CORS policy already explicitly allows
`https://process-engineering-workbench.vercel.app`, `http://localhost:3000`,
`http://127.0.0.1:3000`, and `http://192.168.0.253:3000`.
Credentials are enabled with an explicit origin list, never wildcard origins.
`CORSMiddleware` answers preflights before route authentication dependencies run.
Protected requests still require a validated Supabase token.

## Evidence

- Render service: `process-engineering-workbench-api`
  (`srv-dahh8h4s728c73b3e2rg`), runtime plan `free`.
- Render reported live commit `8d6060658fedbc1e53855b7273cafe3eb429da0e`.
  That commit and local HEAD `e126cb4` have the same CORS policy.
- Logs show shutdown at 20:24:26 UTC, 15 minutes after the last request.
- The first live OPTIONS probe timed out after 45 seconds waiting for a response.
- Render started the replacement process at 20:37:02 UTC; application startup
  completed at 20:38:01 UTC.
- At 20:38:07 UTC, live OPTIONS requests to both `/fluids` and `/projects`
  returned 200 with `Access-Control-Allow-Origin:
  https://process-engineering-workbench.vercel.app`, credentials allowed, GET
  allowed, and `authorization,content-type` request headers allowed.
- Both local preflights also passed before any edits.

These observations establish a cold-start availability failure during this
investigation, not an origin rejection. They support cold start as the explanation
for the reported browser error, but do not prove the cause of the original
incident: its HTTP response status, headers, and timestamp were not supplied.
A failed response from the hosting layer cannot acquire headers from FastAPI's
middleware. There is no demonstrated CORS implementation defect to repair.

## Configuration and operational resolution

No Render CORS environment variable is required. Exact variable name and expected
value: **not applicable**. The application does not read `CORS_ORIGINS`,
`ALLOWED_ORIGINS`, or any other environment variable for CORS; setting one has no
effect. `load_dotenv()` does not change the hard-coded origin list.

Render documents that free web services sleep after 15 idle minutes and take
about a minute to wake: <https://render.com/docs/free>.
An always-on paid instance removes this idle-sleep cause. This investigation did
not change the service plan, trigger a deployment, commit, or push.
Waking the service restored successful probes but does not prevent recurrence.

If the error recurs while the service is warm, capture the failed OPTIONS status,
response headers, exact destination URL, Origin, and UTC timestamp and correlate
them with Render logs before changing the allowlist. Confirm that the frontend
targets `https://process-engineering-workbench-api.onrender.com`.

## Regression validation

`tests/test_cors.py` exercises the actual app without database startup or external
authentication calls. It checks production and all existing development origins,
rejected origins, preflight bypass of authentication, missing/invalid token
rejection, successful verified-token access, and CORS headers on GET responses.

Full Python suite: `.venv/Scripts/python.exe -m unittest discover -s tests -v`
passed all 106 tests (4.225 seconds reported by unittest). Existing FastAPI
`on_event` deprecation warnings remain unrelated to this diagnosis.
