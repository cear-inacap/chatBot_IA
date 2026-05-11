# ============================================
# IMPORTS
# ============================================

import azure.cognitiveservices.speech as speechsdk
from openai import AzureOpenAI
from dotenv import load_dotenv

import os
import threading
import time
import subprocess

import numpy as np
import sounddevice as sd
import soundfile as sf



# 🔥 websocket
from backend.ws_server import broadcast_safe, run_ws_server

# ============================================
# ENV
# ============================================

ruta_env = os.path.join(os.path.dirname(__file__), "keys.env")
load_dotenv(ruta_env)

RUTA_AUDIO = os.path.join(os.path.dirname(__file__), "create_audio/inicio.wav")

speech_key = os.getenv("SPEECH_KEY")
speech_region = os.getenv("SPEECH_REGION")

openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-02-15-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

deployment = os.getenv("DEPLOYMENT_NAME")

ocupado = False
recognizer = None

# ============================================
# 🧠 ESTADOS
# ============================================

def enviar_estado(estado):
    print("Estado:", estado)
    broadcast_safe(estado)

# ============================================
# AUDIO CONTROL
# ============================================

def pausar_escucha():
    global recognizer
    if recognizer:
        recognizer.stop_continuous_recognition()


def reanudar_escucha():
    global recognizer
    if recognizer:
        recognizer.start_continuous_recognition()

# ============================================
# AUDIO PLAY
# ============================================

def reproducir_audio(ruta):
    try:
        subprocess.run(["aplay", ruta])
    except Exception as e:
        print("Error audio:", e)

# ============================================
# TTS
# ============================================



def hablar(texto):

    speech_config = speechsdk.SpeechConfig(
        subscription=speech_key,
        region=speech_region
    )

    speech_config.speech_synthesis_voice_name = "es-MX-DaliaNeural"

    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)

    texto = texto.replace("&", "y")

    ssml = f"""
    <speak version="1.0" xml:lang="es-MX">
      <voice name="es-MX-DaliaNeural">
        <prosody rate="0.95">
          {texto}
        </prosody>
      </voice>
    </speak>
    """

    enviar_estado("talking")

    result = synthesizer.speak_ssml_async(ssml).get()

    with open("temp.wav", "wb") as f:
        f.write(result.audio_data)

    subprocess.run(["aplay", "temp.wav"])

    enviar_estado("listening")
# ============================================
# GPT
# ============================================

def preguntar_gpt(texto):

    response = openai_client.chat.completions.create(
        model=deployment,
        messages=[
            {
                "role": "system",
                "content": "Eres un asistente claro, breve y directo. Máximo 200 caracteres."
            },
            {
                "role": "user",
                "content": texto
            }
        ],
        max_tokens=150
    )

    return response.choices[0].message.content

# ============================================
# PROCESO PRINCIPAL
# ============================================

def procesar(texto):

    global ocupado

    ocupado = True
    print("Procesando...")

    enviar_estado("thinking")

    pausar_escucha()

    try:
        inicio = time.time()

        # sonido inmediato
        threading.Thread(
            target=reproducir_audio,
            args=(RUTA_AUDIO,)
        ).start()

        respuesta = preguntar_gpt(texto)

        print("GPT:", respuesta)
        print("Tiempo:", round(time.time() - inicio, 2))

        time.sleep(0.3)

        enviar_estado("talking")

        hablar(respuesta)

    except Exception as e:
        print("Error:", e)

    reanudar_escucha()

    enviar_estado("listening")

    ocupado = False

# ============================================
# STT
# ============================================

def escuchar_continuo():

    global recognizer

    speech_config = speechsdk.SpeechConfig(
        subscription=speech_key,
        region=speech_region
    )

    speech_config.set_property(
        speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        "800"
    )

    speech_config.speech_recognition_language = "es-ES"

    audio_config = speechsdk.AudioConfig(device_name="plughw:0,0")

    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config
    )

    print("Escuchando...")

    def recognized(evt):

        global ocupado

        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:

            texto = evt.result.text.strip()
            print("Texto:", texto)

            if texto == "" or ocupado:
                return

            enviar_estado("listening")

            threading.Thread(
                target=procesar,
                args=(texto,)
            ).start()

    recognizer.recognized.connect(recognized)

    recognizer.start_continuous_recognition()

    while True:
        time.sleep(0.1)

# ============================================
# MAIN
# ============================================

if __name__ == "__main__":

    # 🔥 iniciar websocket en hilo
    threading.Thread(target=run_ws_server, daemon=True).start()

    time.sleep(1)

    enviar_estado("listening")

    escuchar_continuo()