import azure.cognitiveservices.speech as speechsdk
import os
from dotenv import load_dotenv


ruta_env = os.path.join(os.path.dirname(__file__), "keys.env")
load_dotenv(ruta_env)

speech_key = os.getenv("SPEECH_KEY")
speech_region = os.getenv("SPEECH_REGION")

# Configuración
speech_config = speechsdk.SpeechConfig(
    subscription=speech_key,
    region=speech_region
)

# Guardar a archivo
audio_config = speechsdk.audio.AudioOutputConfig(filename="inicio.wav")

synthesizer = speechsdk.SpeechSynthesizer(
    speech_config=speech_config,
    audio_config=audio_config
)

# SSML (voz natural LATAM)
ssml = """
<speak version='1.0' xml:lang='es-MX'>
    <voice name='es-MX-DaliaNeural'>
        <prosody rate='0.99' pitch='+1%'>
            .,Hola, dame un momento
        </prosody>
    </voice>
</speak>
"""

print("🎙 Generando audio...")

synthesizer.speak_ssml_async(ssml).get()

print("✅ Archivo creado")