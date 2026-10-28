import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.services import transcription

print("Whisper available:", transcription.is_whisper_available())
config = transcription.get_whisper_config()
print("Config:", config)

async def test():
    loaded = await transcription.load_model()
    print("Model loaded successfully:", loaded)

asyncio.run(test())
