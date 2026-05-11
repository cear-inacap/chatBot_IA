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
import json

import numpy as np
import sounddevice as sd
import soundfile as sf



# 🔥 websocket
from backend.ws_server import broadcast_safe, run_ws_server, set_message_handler

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
despierto = False
escuchando = False
sleep_timer = None
state_lock = threading.Lock()

INACTIVITY_SECONDS = int(os.getenv("INACTIVITY_SECONDS", "4"))
VOLUME_STEP = int(os.getenv("VOLUME_STEP", "5"))
VOLUME_MIN = int(os.getenv("VOLUME_MIN", "20"))
VOLUME_MAX = int(os.getenv("VOLUME_MAX", "85"))

# ============================================
# 🧠 ESTADOS
# ============================================

def enviar_estado(estado, texto=None):
    print("Estado:", estado)

    if texto is None:
        broadcast_safe(estado)
        return

    broadcast_safe(json.dumps({
        "emotion": estado,
        "text": texto
    }, ensure_ascii=False))


def enviar_texto(texto):
    broadcast_safe(json.dumps({
        "text": texto
    }, ensure_ascii=False))


def ejecutar_comando(comando):
    try:
        return subprocess.run(
            comando,
            check=True,
            capture_output=True,
            text=True
        )
    except Exception as e:
        print("Error ejecutando comando:", comando, e)
        return None


def obtener_volumen_actual():
    resultado = ejecutar_comando([
        "pactl",
        "get-sink-volume",
        "@DEFAULT_SINK@"
    ])

    if not resultado:
        return None

    for parte in resultado.stdout.replace("/", " ").split():
        if parte.endswith("%") and parte[:-1].isdigit():
            return int(parte[:-1])

    return None


def cambiar_volumen(direccion):
    if direccion not in ("up", "down"):
        return

    volumen_actual = obtener_volumen_actual()

    if volumen_actual is None:
        enviar_texto("No pude leer el volumen")
        return

    if direccion == "up":
        volumen_nuevo = min(volumen_actual + VOLUME_STEP, VOLUME_MAX)
    else:
        volumen_nuevo = max(volumen_actual - VOLUME_STEP, VOLUME_MIN)

    if volumen_nuevo == volumen_actual:
        enviar_texto(f"Volumen {volumen_actual}%")
        return

    resultado = ejecutar_comando([
        "pactl",
        "set-sink-volume",
        "@DEFAULT_SINK@",
        f"{volumen_nuevo}%"
    ])

    if resultado:
        enviar_texto(f"Volumen {volumen_nuevo}%")
    else:
        enviar_texto("No pude cambiar el volumen")


def cancelar_timer_sleep():
    global sleep_timer

    if sleep_timer:
        sleep_timer.cancel()
        sleep_timer = None


def programar_sleep():
    global sleep_timer

    cancelar_timer_sleep()
    sleep_timer = threading.Timer(INACTIVITY_SECONDS, dormir_por_inactividad)
    sleep_timer.daemon = True
    sleep_timer.start()


def dormir_por_inactividad():
    with state_lock:
        if ocupado or not despierto:
            return

    dormir("")


def despertar():
    global despierto

    with state_lock:
        if despierto:
            enviar_estado("listening", "Te escucho")
            programar_sleep()
            return

        despierto = True

    reanudar_escucha()
    enviar_estado("listening", "Te escucho")
    programar_sleep()


def dormir(texto="Presiona para despertar"):
    global despierto

    with state_lock:
        despierto = False

    cancelar_timer_sleep()
    pausar_escucha()
    enviar_estado("sleepy", texto)


def manejar_comando_ws(message):
    try:
        payload = json.loads(message)
    except Exception:
        payload = {"command": str(message).strip()}

    command = str(payload.get("command", "")).strip().lower()

    if command in ("wake", "start", "listening"):
        despertar()
    elif command in ("sleep", "stop"):
        dormir()
    elif command in ("volume_up", "vol_up"):
        cambiar_volumen("up")
    elif command in ("volume_down", "vol_down"):
        cambiar_volumen("down")

# ============================================
# AUDIO CONTROL
# ============================================

def pausar_escucha():
    global recognizer, escuchando

    if recognizer and escuchando:
        recognizer.stop_continuous_recognition()
        escuchando = False


def reanudar_escucha():
    global recognizer, escuchando

    if recognizer and not escuchando:
        recognizer.start_continuous_recognition()
        escuchando = True

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

    enviar_estado("talking", texto)

    result = synthesizer.speak_ssml_async(ssml).get()

    with open("temp.wav", "wb") as f:
        f.write(result.audio_data)

    subprocess.run(["aplay", "temp.wav"])
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
        max_completion_tokens=150
    )

    return response.choices[0].message.content

# ============================================
# PROCESO PRINCIPAL
# ============================================

def procesar(texto):

    global ocupado

    with state_lock:
        if not despierto:
            ocupado = False
            return

        ocupado = True

    cancelar_timer_sleep()
    print("Procesando...")

    enviar_estado("thinking", "... pensando ...")

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

        hablar(respuesta)

    except Exception as e:
        print("Error:", e)

    with state_lock:
        debe_escuchar = despierto
        ocupado = False

    if debe_escuchar:
        reanudar_escucha()
        enviar_estado("listening", "Te escucho")
        programar_sleep()

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

    audio_config = speechsdk.AudioConfig(device_name="plughw:2,0")

    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config
    )

    print("Micrófono listo")

    def recognized(evt):
        global ocupado

        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:

            texto = evt.result.text.strip()
            print("Texto:", texto)

            with state_lock:
                ignorar = texto == "" or ocupado or not despierto

                if not ignorar:
                    ocupado = True

            if ignorar:
                return

            enviar_estado("listening", texto)

            threading.Thread(
                target=procesar,
                args=(texto,)
            ).start()

    recognizer.recognized.connect(recognized)

    enviar_estado("sleepy", "Presiona para despertar")

    while True:
        time.sleep(0.1)

# ============================================
# MAIN
# ============================================

if __name__ == "__main__":

    set_message_handler(
        lambda message: threading.Thread(
            target=manejar_comando_ws,
            args=(message,),
            daemon=True
        ).start()
    )

    # 🔥 iniciar websocket en hilo
    threading.Thread(target=run_ws_server, daemon=True).start()

    time.sleep(1)

    escuchar_continuo()
