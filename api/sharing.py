"""Revocable, scoped doctor-view sessions. Capabilities never bypass the grant row."""
import datetime as dt
import hashlib
import secrets
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

NO_STORE = {'Cache-Control': 'no-store, private, max-age=0', 'Pragma': 'no-cache',
            'Expires': '0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'}
LEASE_MS = 900
ASSETS = Path(__file__).parent / 'doctor-web'


class ShareOptions(BaseModel):
    report_ids: list[UUID] | None = Field(default=None, max_length=100)
    recipient_label: str = Field(default='My clinician', max_length=100)
    duration_minutes: int = Field(default=30, ge=5, le=30)


class Redeem(BaseModel):
    token: str = Field(min_length=20, max_length=100)


class Viewer(BaseModel):
    share_id: UUID
    viewer_token: str = Field(min_length=20, max_length=100)


class Revoke(BaseModel):
    share_id: UUID | None = None


def now():
    return dt.datetime.now(dt.timezone.utc)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def deny(reason, status=410):
    raise HTTPException(status_code=status, detail=reason, headers=NO_STORE)


def assert_active(record, at=None):
    if record.get('revoked_at') is not None:
        deny('revoked')
    expiry = dt.datetime.fromisoformat(record['expires_at'].replace('Z', '+00:00'))
    if expiry <= (at or now()):
        deny('expired')
    if record.get('scope', {}).get('version') != 2:
        deny('replaced')


def validate_viewer(db, body):
    rows = db.table('share_tokens').select('*').eq('id', str(body.share_id)).execute().data
    if not rows:
        deny('invalid', 404)
    row = rows[0]
    expected = row.get('scope', {}).get('viewer_hash', '')
    if not row.get('used_at') or not expected or not secrets.compare_digest(expected, digest(body.viewer_token)):
        deny('invalid', 404)
    assert_active(row)
    return row


def safe_result(data):
    return JSONResponse(data, headers=NO_STORE)


def build_share_router(client_factory, verify_user):
    router = APIRouter()

    @router.post('/share')
    def create(request: Request, body: ShareOptions = ShareOptions(), user_id: str = Depends(verify_user)):
        db = client_factory()
        stamp = now()
        query = db.table('reports').select('id').eq('user_id', user_id).eq('status', 'processed')
        requested = [str(i) for i in body.report_ids] if body.report_ids is not None else None
        if requested is not None:
            if not requested:
                deny('Select at least one report.', 422)
            query = query.in_('id', requested)
        report_ids = [r['id'] for r in query.execute().data]
        if not report_ids or (requested is not None and set(requested) != set(report_ids)):
            deny('Some selected reports are unavailable or do not belong to you.', 422)
        if len(report_ids) > 100:
            deny('Choose up to 100 reports for this share.', 422)
        # Opened grants are revoked too. used_at is NOT a reason to keep access.
        db.table('share_tokens').update({'revoked_at': stamp.isoformat()}).eq('user_id', user_id).is_('revoked_at', 'null').execute()
        token = secrets.token_urlsafe(32)
        expiry = stamp + dt.timedelta(minutes=body.duration_minutes)
        scope = {'version': 2, 'report_ids': report_ids, 'recipient_label': body.recipient_label.strip() or 'My clinician'}
        inserted = db.table('share_tokens').insert({'user_id': user_id, 'token_hash': digest(token),
            'created_at': stamp.isoformat(), 'expires_at': expiry.isoformat(), 'scope': scope}).execute().data
        if not inserted:
            deny('Could not create a share.', 503)
        base = str(request.base_url).rstrip('/')
        if request.headers.get('x-forwarded-proto') == 'https' and base.startswith('http:'):
            base = 'https:' + base[len('http:'):]
        # URL fragments stay in the browser and are absent from HTTP access logs.
        return safe_result({'id': inserted[0]['id'], 'share_url': f'{base}/share/open#{token}',
            'expires_at': expiry.isoformat(), 'report_count': len(report_ids), 'recipient_label': scope['recipient_label']})

    @router.get('/shares')
    def list_grants(user_id: str = Depends(verify_user)):
        rows = client_factory().table('share_tokens').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(30).execute().data
        return safe_result({'shares': [{'id': r['id'], 'created_at': r['created_at'], 'expires_at': r['expires_at'],
            'opened_at': r.get('used_at'), 'revoked_at': r.get('revoked_at'),
            'recipient_label': r.get('scope', {}).get('recipient_label', 'Previous share'),
            'report_count': len(r.get('scope', {}).get('report_ids', [])),
            'legacy': r.get('scope', {}).get('version') != 2} for r in rows]})

    @router.post('/share/revoke')
    def revoke(body: Revoke, user_id: str = Depends(verify_user)):
        query = client_factory().table('share_tokens').update({'revoked_at': now().isoformat()}).eq('user_id', user_id).is_('revoked_at', 'null')
        if body.share_id is not None:
            query = query.eq('id', str(body.share_id))
        changed = query.execute().data
        return safe_result({'revoked': len(changed), 'acknowledged_at': now().isoformat()})

    @router.get('/doctor-assets/{asset}')
    def asset(asset: str):
        if asset not in ('doctor.js', 'doctor.css'):
            deny('invalid', 404)
        return FileResponse(ASSETS / asset, headers=NO_STORE,
                            media_type='text/javascript' if asset.endswith('.js') else 'text/css')

    @router.get('/share/{token}')
    def page(token: str):
        headers = {**NO_STORE, 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}
        return FileResponse(ASSETS / 'index.html', media_type='text/html', headers=headers)

    @router.post('/share/redeem')
    def redeem(body: Redeem):
        db = client_factory()
        rows = db.table('share_tokens').select('*').eq('token_hash', digest(body.token)).execute().data
        if not rows:
            deny('invalid', 404)
        grant = rows[0]
        stamp = now()
        assert_active(grant, stamp)
        if grant.get('used_at') is not None:
            deny('used')
        viewer_token = secrets.token_urlsafe(32)
        scope = {**grant['scope'], 'viewer_hash': digest(viewer_token)}
        # This guarded write also loses races to revocation or expiry.
        changed = db.table('share_tokens').update({'used_at': stamp.isoformat(), 'scope': scope}).eq('id', grant['id']).is_('used_at', 'null').is_('revoked_at', 'null').gt('expires_at', stamp.isoformat()).execute().data
        if not changed:
            deny('unavailable')
        return safe_result({'share_id': grant['id'], 'viewer_token': viewer_token, 'expires_at': grant['expires_at']})

    @router.post('/share/session')
    def session(body: Viewer):
        grant = validate_viewer(client_factory(), body)
        return safe_result({'active': True, 'lease_ms': LEASE_MS, 'expires_at': grant['expires_at']})

    @router.post('/share/records')
    def records(body: Viewer):
        db = client_factory()
        grant = validate_viewer(db, body)
        ids = grant['scope'].get('report_ids', [])
        user_id = grant['user_id']
        # Never provide a signed file URL: it would outlive the revocable view.
        reports = db.table('reports').select('id, title, report_date, file_type').eq('user_id', user_id).eq('status', 'processed').in_('id', ids).order('report_date', desc=True).execute().data
        observations = []
        # PostgREST commonly caps a response at 1,000 rows. Page explicitly so
        # large shares do not silently lose results (100 reports x 200 values).
        for offset in range(0, 20000, 1000):
            page = db.table('extracted_observations').select('report_id, test_name, value, unit, reference_range, observed_at, flagged').eq('user_id', user_id).in_('report_id', ids).order('id').range(offset, offset + 999).execute().data
            observations.extend(page)
            if len(page) < 1000:
                break
        profiles = db.table('profiles').select('full_name').eq('id', user_id).execute().data
        # A revocation committed during the data fetch must still prevent delivery.
        validate_viewer(db, body)
        return safe_result({'patient_name': profiles[0].get('full_name') if profiles else None,
            'generated_at': now().isoformat(), 'expires_at': grant['expires_at'],
            'recipient_label': grant['scope'].get('recipient_label', 'Clinician'),
            'reports': [{**r, 'observations': [{k: v for k, v in o.items() if k != 'report_id'}
                for o in observations if o['report_id'] == r['id']]} for r in reports]})

    return router
