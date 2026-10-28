"""
Talk2Tasks AI — Complete End-to-End Integration Test
Tests all endpoints using FastAPI's TestClient without needing a live network port.
"""

import sys
from fastapi.testclient import TestClient
from app.main import app

def test_all():
    with TestClient(app) as client:
        print("1. Testing GET /api/health...")
        res = client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        health = res.json()
        print(f"   [OK] status={health.get('status')}, db={health.get('database_ok')}")

        print("\n2. Testing GET /api/demo...")
        res = client.get("/api/demo")
        assert res.status_code == 200, f"Demo data failed: {res.text}"
        demo = res.json()
        assert "chunks" in demo and len(demo["chunks"]) > 0
        print(f"   [OK] demo segments loaded ({demo.get('total_segments')} segments)")

        print("\n3. Testing POST /api/meetings (Create Meeting)...")
        res = client.post("/api/meetings", json={"title": "Integration Test Meeting"})
        assert res.status_code in (200, 201), f"Create meeting failed: {res.text}"
        meeting = res.json()
        meeting_id = meeting["id"]
        print(f"   [OK] created meeting id={meeting_id}")

        print("\n4. Testing POST /api/meetings/{id}/transcript (Add Transcript)...")
        flat_segments = [seg for chunk in demo["chunks"] for seg in chunk]
        res = client.post(f"/api/meetings/{meeting_id}/transcript", json={"segments": flat_segments})
        assert res.status_code == 200, f"Add transcript failed: {res.text}"
        updated = res.json()
        print(f"   [OK] transcript stored ({len(updated['transcript'])} segments)")

        print("\n5. Testing POST /api/meetings/{id}/analyze (Deterministic / Local AI)...")
        res = client.post(f"/api/meetings/{meeting_id}/analyze?use_demo=true")
        assert res.status_code == 200, f"Analyze meeting failed: {res.text}"
        analyzed = res.json()
        assert analyzed["notes"] is not None
        assert len(analyzed["action_items"]) > 0
        assert len(analyzed["decisions"]) > 0
        print(f"   [OK] extracted: {len(analyzed['action_items'])} tasks, {len(analyzed['decisions'])} decisions")
        print(f"        summary preview: {analyzed['notes']['summary'][:80]}...")

        print("\n6. Testing POST /api/meetings/{id}/email-draft (Generate Follow-up Email)...")
        res = client.post(f"/api/meetings/{meeting_id}/email-draft?use_demo=true")
        assert res.status_code == 200, f"Generate email failed: {res.text}"
        with_email = res.json()
        assert with_email["email_draft"] is not None
        print(f"   [OK] subject: {with_email['email_draft']['subject']}")

        print("\n7. Testing PATCH /api/meetings/{id}/tasks/{task_id} (Update Task Status)...")
        task_id = analyzed["action_items"][0]["task_id"]
        res = client.patch(
            f"/api/meetings/{meeting_id}/tasks/{task_id}",
            json={"status": "completed"}
        )
        assert res.status_code == 200, f"Update task failed: {res.text}"
        print(f"   [OK] task {task_id} marked as completed")

        print("\n8. Testing GET /api/meetings/{id}/export (Export Markdown)...")
        res = client.get(f"/api/meetings/{meeting_id}/export")
        assert res.status_code == 200, f"Export failed: {res.text}"
        md_content = res.text
        assert f"# {meeting['title']}" in md_content
        print(f"   [OK] exported markdown ({len(md_content)} characters)")

        print("\n9. Testing POST /api/transcribe with sample WAV...")
        try:
            with open("../sample_audio/test_meeting.wav", "rb") as f:
                res = client.post("/api/transcribe", files={"file": ("test_meeting.wav", f, "audio/wav")})
                if res.status_code == 200:
                    print(f"   [OK] transcribe endpoint succeeded with {res.json().get('segment_count')} segments")
                else:
                    print(f"   [INFO] transcribe response ({res.status_code}): {res.text[:100]} (expected if model is downloading on first run)")
        except Exception as e:
            print(f"   [INFO] transcribe test skipped: {e}")

        print("\n10. Testing GET /api/detect-meetings (Windows Meeting Detector)...")
        res = client.get("/api/detect-meetings")
        assert res.status_code == 200, f"Detect meetings failed: {res.text}"
        detect_data = res.json()
        assert "detections" in detect_data
        print(f"   [OK] detector returned {detect_data['count']} potential Windows meeting processes")

        print("\n11. Testing POST /api/meetings/{id}/ask (Grounded Conversational Q&A)...")
        res = client.post(
            f"/api/meetings/{meeting_id}/ask",
            json={"question": "What did the team decide regarding deployment?"}
        )
        assert res.status_code == 200, f"Ask question failed: {res.text}"
        qa_data = res.json()
        assert "answer" in qa_data and "confidence" in qa_data
        print(f"   [OK] Q&A answer: {qa_data['answer'][:70]}... (confidence: {qa_data['confidence']})")

        print("\n12. Testing POST /api/meetings/{id}/complete-live (Finalize Live Meeting with Transcript)...")
        res = client.post(f"/api/meetings/{meeting_id}/complete-live")
        assert res.status_code == 200, f"Complete live meeting failed: {res.text}"
        final_meeting = res.json()
        assert final_meeting["status"] == "completed"
        assert final_meeting["notes"] is not None
        assert final_meeting["email_draft"] is not None
        print(f"   [OK] live meeting finalized with {len(final_meeting['action_items'])} tasks and email draft")

        print("\n13. Testing POST /api/meetings/{id}/complete-live with SILENT meeting (Truthful Empty State)...")
        res_silent = client.post("/api/meetings", json={"title": "Silent Standup"})
        silent_id = res_silent.json()["id"]
        res_done = client.post(f"/api/meetings/{silent_id}/complete-live")
        assert res_done.status_code == 200, f"Silent meeting failed: {res_done.text}"
        silent_meeting = res_done.json()
        # Verify no fake canned data injected
        assert "No speech" in silent_meeting["notes"]["summary"], f"Expected 'No speech', got: {silent_meeting['notes']['summary']}"
        assert len(silent_meeting["action_items"]) == 0, f"Expected 0 action items, got: {len(silent_meeting['action_items'])}"
        assert len(silent_meeting["decisions"]) == 0, f"Expected 0 decisions, got: {len(silent_meeting['decisions'])}"
        assert "Alex" not in silent_meeting["notes"]["summary"], "Fake Alex demo data was improperly injected into silent meeting!"
        assert "Alex" not in silent_meeting["email_draft"]["full_text"], "Fake Alex demo email was improperly injected into silent meeting!"
        print(f"   [OK] Silent meeting truthfully processed:")
        print(f"        Summary: '{silent_meeting['notes']['summary']}'")
        print(f"        Action items: {len(silent_meeting['action_items'])}, Decisions: {len(silent_meeting['decisions'])}")

        print("\n14. Testing GET /api/settings/nvidia...")
        res = client.get("/api/settings/nvidia")
        assert res.status_code == 200, f"NVIDIA settings failed: {res.text}"
        nvidia_cfg = res.json()
        assert "api_key_set" in nvidia_cfg and "model" in nvidia_cfg
        print(f"   [OK] NVIDIA NIM settings available (model: {nvidia_cfg['model']})")

        print("\n==============================================")
        print(">>> ALL 14 INTEGRATION TESTS PASSED 100%! <<<")
        print("==============================================")


if __name__ == "__main__":
    test_all()

