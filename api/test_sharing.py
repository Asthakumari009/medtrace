"""Offline authorization regression tests. No real accounts or medical records."""
import copy
import datetime as dt
import unittest
from types import SimpleNamespace
from uuid import uuid4
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
from sharing import build_share_router, now

class Query:
    def __init__(self, db, table):
        self.db, self.name, self.filters = db, table, []
        self.mode, self.payload, self.fields, self.cap, self.ordering = "select", None, "*", None, None
        self.offset = 0
    def select(self, fields): self.fields = fields; return self
    def update(self, payload): self.mode, self.payload = "update", payload; return self
    def insert(self, payload): self.mode, self.payload = "insert", payload; return self
    def eq(self, key, value): self.filters.append(lambda r: r.get(key) == value); return self
    def is_(self, key, value): self.filters.append(lambda r: r.get(key) is None); return self
    def gt(self, key, value): self.filters.append(lambda r: r.get(key, "") > value); return self
    def in_(self, key, values): self.filters.append(lambda r: r.get(key) in values); return self
    def order(self, key, desc=False): self.ordering = key, desc; return self
    def limit(self, cap): self.cap = cap; return self
    def range(self, first, last): self.offset, self.cap = first, last - first + 1; return self
    def execute(self):
        table = self.db.rows.setdefault(self.name, [])
        if self.mode == "insert":
            row = {"id": str(uuid4()), "used_at": None, "revoked_at": None, **copy.deepcopy(self.payload)}
            table.append(row); return SimpleNamespace(data=[copy.deepcopy(row)])
        rows = [r for r in table if all(f(r) for f in self.filters)]
        if self.ordering:
            key, desc = self.ordering; rows.sort(key=lambda r: r.get(key) or "", reverse=desc)
        if self.cap is not None: rows = rows[self.offset:self.offset+self.cap]
        if self.mode == "update":
            for r in rows: r.update(copy.deepcopy(self.payload))
        output = copy.deepcopy(rows)
        if self.fields != "*":
            fields = [f.strip() for f in self.fields.split(",")]
            output = [{f: r.get(f) for f in fields} for r in output]
        if self.db.after_read and self.mode == "select": self.db.after_read(self.name)
        return SimpleNamespace(data=output)

class FakeDB:
    def __init__(self): self.rows, self.after_read = {}, None
    def table(self, name): return Query(self, name)

class SharingTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB()
        self.r1, self.r2, self.other = str(uuid4()), str(uuid4()), str(uuid4())
        self.db.rows = {
            "reports": [{"id": rid, "user_id": owner, "status": "processed", "title": title, "report_date": "2026-09-01", "file_type": "pdf", "file_path": "secret-original"}
                        for rid, owner, title in [(self.r1,"patient-a","Selected report"),(self.r2,"patient-a","Private report"),(self.other,"patient-b","Another patient")]],
            "extracted_observations": [{"report_id": rid, "user_id": owner, "test_name": title, "value": "5", "unit": "%", "flagged": False}
                        for rid, owner, title in [(self.r1,"patient-a","Selected reading"),(self.r2,"patient-a","Private reading"),(self.other,"patient-b","Another patient reading")]],
            "profiles": [{"id": "patient-a", "full_name": "Synthetic Patient"}], "share_tokens": [],
        }
        def user(x_user: str = Header(default="patient-a")): return x_user
        app = FastAPI(); app.include_router(build_share_router(lambda: self.db, user))
        self.client = TestClient(app)
    def create(self, ids=None):
        r = self.client.post("/share", json={"report_ids": ids or [self.r1], "recipient_label": "Visit", "duration_minutes": 5})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()
    def redeem(self, grant):
        r = self.client.post("/share/redeem", json={"token": grant["share_url"].split("#",1)[1]})
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json(); return {"share_id": data["share_id"], "viewer_token": data["viewer_token"]}
    def test_opened_share_revocation_blocks_all_subsequent_reads(self):
        grant = self.create(); viewer = self.redeem(grant)
        self.assertEqual(self.client.post("/share/records", json=viewer).status_code, 200)
        revoked = self.client.post("/share/revoke", json={"share_id": grant["id"]})
        self.assertEqual(revoked.json()["revoked"], 1)
        for path in ["session", "records"]:
            result = self.client.post(f"/share/{path}", json=viewer)
            self.assertEqual(result.status_code, 410)
            self.assertIn("no-store", result.headers["cache-control"])
    def test_selected_scope_and_no_download_urls(self):
        viewer = self.redeem(self.create())
        result = self.client.post("/share/records", json=viewer)
        data = result.json()
        self.assertEqual([r["id"] for r in data["reports"]], [self.r1])
        self.assertEqual(data["reports"][0]["observations"][0]["test_name"], "Selected reading")
        for secret in ["Private reading", "Another patient", "file_path", "secret-original", "signedUrl"]: self.assertNotIn(secret, result.text)
        self.assertIn("no-store", result.headers["cache-control"])
    def test_qr_replay_and_forged_viewer_fail(self):
        grant = self.create(); viewer = self.redeem(grant)
        replay = self.client.post("/share/redeem", json={"token": grant["share_url"].split("#",1)[1]})
        self.assertEqual(replay.status_code, 410)
        self.assertEqual(self.client.post("/share/session", json={**viewer,"viewer_token":"x"*40}).status_code, 404)
        self.assertNotIn(viewer["viewer_token"], str(self.db.rows["share_tokens"]))
    def test_other_owner_cannot_share_or_revoke_patient_records(self):
        self.assertEqual(self.client.post("/share", json={"report_ids":[self.other]}).status_code, 422)
        grant = self.create(); viewer = self.redeem(grant)
        r = self.client.post("/share/revoke", json={"share_id":grant["id"]}, headers={"x-user":"patient-b"})
        self.assertEqual(r.json()["revoked"], 0)
        self.assertEqual(self.client.post("/share/session", json=viewer).status_code, 200)
    def test_expired_and_legacy_sessions_fail_closed(self):
        viewer = self.redeem(self.create())
        self.db.rows["share_tokens"][0]["expires_at"] = (now()-dt.timedelta(seconds=1)).isoformat()
        self.assertEqual(self.client.post("/share/session", json=viewer).status_code, 410)
        self.db.rows["share_tokens"][0]["expires_at"] = (now()+dt.timedelta(minutes=10)).isoformat()
        self.db.rows["share_tokens"][0]["scope"]["version"] = 1
        self.assertEqual(self.client.post("/share/records", json=viewer).status_code, 410)
    def test_revocation_during_fetch_prevents_delivery(self):
        grant = self.create(); viewer = self.redeem(grant)
        def revoke_after_read(table):
            if table == "extracted_observations": self.db.rows["share_tokens"][0]["revoked_at"] = now().isoformat()
        self.db.after_read = revoke_after_read
        result = self.client.post("/share/records", json=viewer)
        self.assertEqual(result.status_code, 410)
        self.assertNotIn("Selected reading", result.text)
    def test_new_grant_replaces_opened_grant_and_list_hides_credentials(self):
        viewer = self.redeem(self.create()); fresh = self.create([self.r2])
        self.assertEqual(self.client.post("/share/session", json=viewer).status_code, 410)
        result = self.client.get("/shares")
        self.assertNotIn("viewer_hash", result.text); self.assertNotIn("token_hash", result.text)
        self.assertEqual(len(result.json()["shares"]),2)
        self.assertEqual(self.client.post("/share/session", json=self.redeem(fresh)).status_code,200)
    def test_html_and_assets_have_no_store_and_strict_policy(self):
        result = self.client.get("/share/synthetic-token-not-a-real-grant")
        self.assertEqual(result.status_code,200)
        self.assertIn("no-store",result.headers["cache-control"])
        self.assertIn("frame-ancestors 'none'",result.headers["content-security-policy"])
        self.assertEqual(self.client.get("/doctor-assets/doctor.js").status_code,200)
        self.assertEqual(self.client.get("/doctor-assets/secret.txt").status_code,404)

    def test_large_shares_page_results_without_silent_truncation(self):
        ids = []
        self.db.rows['reports'] = []
        self.db.rows['extracted_observations'] = []
        for i in range(6):
            rid = str(uuid4()); ids.append(rid)
            self.db.rows['reports'].append({'id':rid,'user_id':'patient-a','title':f'Report {i}', 'status':'processed','report_date':'2026-09-01','file_type':'pdf'})
            for j in range(200):
                self.db.rows['extracted_observations'].append({'id':f'{i}-{j:03}', 'report_id':rid,'user_id':'patient-a','test_name':f'Test {j}','value':'1'})
        result = self.client.post('/share/records', json=self.redeem(self.create(ids)))
        self.assertEqual(result.status_code,200)
        self.assertEqual(sum(len(r['observations']) for r in result.json()['reports']),1200)

if __name__ == "__main__": unittest.main()
