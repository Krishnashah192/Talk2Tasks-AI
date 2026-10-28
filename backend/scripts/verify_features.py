import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services import llm as llm_service
from app.services import transcription
from app.schemas import TranscriptSegment

async def test_nvidia_persistence():
    print("--- 1. Testing NVIDIA NIM Persistence ---")
    llm_service.set_nvidia_config(
        api_key="nvapi-test-key-demo-12345",
        model="custom/my-special-llm-model",
        base_url="https://integrate.api.nvidia.com/v1"
    )
    
    cfg = llm_service.get_nvidia_config()
    print("Runtime config:", cfg)
    assert cfg["model"] == "custom/my-special-llm-model", "Model mismatch!"
    assert cfg["api_key_set"] is True, "API key not set!"
    
    # Verify file on disk
    config_file = Path("./data/nvidia_config.json")
    assert config_file.exists(), "Config file not found on disk!"
    disk_data = json.loads(config_file.read_text(encoding="utf-8"))
    print("Disk persisted config:", disk_data)
    assert disk_data["model"] == "custom/my-special-llm-model"
    assert disk_data["api_key"] == "nvapi-test-key-demo-12345"
    print("NVIDIA Config persistence: PASSED")

async def test_extraction():
    print("\n--- 2. Testing Improved Task, Deadline & Conclusion Extraction ---")
    segments = [
        TranscriptSegment(start_time=0.0, end_time=4.0, speaker="Rahul", text="Let's conclude our sprint planning."),
        TranscriptSegment(start_time=4.5, end_time=9.0, speaker="Rahul", text="The conclusion is we will deploy the beta build next Monday."),
        TranscriptSegment(start_time=9.5, end_time=15.0, speaker="Amit", text="I will finish the OAuth2 authentication API by Friday EOD."),
        TranscriptSegment(start_time=15.5, end_time=20.0, speaker="Priya", text="Hum kal tak frontend visualizer update karenge."),
        TranscriptSegment(start_time=20.5, end_time=25.0, speaker="Rahul", text="Agreed, consensus is approved by everyone."),
    ]
    
    analysis = llm_service.deterministic_extract_analysis(segments, "Sprint Sync")
    print(f"Decisions / Conclusions detected: {len(analysis.decisions)}")
    for d in analysis.decisions:
        print(f"  • Decision: {d.description} (Quote: '{d.source_quote}')")
        
    print(f"\nAction Items detected: {len(analysis.action_items)}")
    for a in analysis.action_items:
        print(f"  • Task: {a.task_description} | Owner: {a.owner} | Deadline: {a.deadline} | Conf: {a.confidence}")

    assert len(analysis.decisions) >= 2, "Failed to detect conclusions/decisions!"
    assert len(analysis.action_items) >= 2, "Failed to detect action items!"
    print("Extraction test: PASSED")

if __name__ == "__main__":
    asyncio.run(test_nvidia_persistence())
    asyncio.run(test_extraction())
