# ============================================
# IMPORTACIÓN DE LIBRERÍAS

import azure.cognitiveservices.speech as speechsdk  # SDK de Azure para reconocimiento y síntesis de voz (STT y TTS)
from openai import AzureOpenAI                      # Cliente de Azure OpenAI para usar modelos GPT
from dotenv import load_dotenv                      
import os
# ============================================

# ============================================
# CARGA DE VARIABLES DE ENTORNO


# construir la ruta absoluta al archivo keys.env
# __file__ = ruta del script actual
ruta_env = os.path.join(os.path.dirname(__file__), "keys.env")

# Carga las variables definidas en "keys.env" al entorno del programa
load_dotenv(ruta_env)


# ============================================
# CONFIGURACIÓN DE SERVICIOS

# Obtiene credenciales del servicio de voz (Speech Service)
speech_key = os.getenv("SPEECH_KEY")
speech_region = os.getenv("SPEECH_REGION")

# Crea cliente para Azure OpenAI (GPT)
openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),          # Clave de API
    api_version="2024-02-15-preview",                   # Versión del API
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")   # URL del recurso
)

# Nombre del modelo desplegado en Azure
deployment = os.getenv("DEPLOYMENT_NAME")


# ============================================
# FUNCIÓN: STT (Speech to Text)
# Convierte voz del micrófono en texto

def escuchar():
    # Configuración del servicio de voz
    speech_config = speechsdk.SpeechConfig(
        subscription=speech_key,
        region=speech_region
    )

    # Idioma de reconocimiento
    speech_config.speech_recognition_language = "es-ES"

    # Configura entrada de audio desde micrófono por defecto
    audio_config = speechsdk.AudioConfig(use_default_microphone=True)

    # Crea el reconocedor de voz
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config
    )

    print("Habla ahora...")

    # Escucha UNA sola vez
    result = recognizer.recognize_once()

    # Si se reconoció correctamente
    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        print("📝 Texto:", result.text)
        return result.text

    else:
        print("❌ No se entendió")
        return None


# ============================================
# FUNCIÓN: GPT
# Envía el texto al modelo y obtiene respuesta
# ============================================

def preguntar_gpt(texto):

    # Se envía una conversación al modelo
    response = openai_client.chat.completions.create(
        model=deployment,  # nombre del deployment en Azure

        messages=[
            {
                "role": "system",
                "content": "Eres un asistente de la institución inacap, claro y amable."
            },
            {
                "role": "user",
                "content": texto
            }
        ],

        max_tokens=200  # límite de respuesta
    )

    # Extrae el texto generado por el modelo
    respuesta = response.choices[0].message.content

    print("🤖 GPT:", respuesta)

    return respuesta


# ============================================
# FUNCIÓN: TTS (Text to Speech)
# Convierte texto en voz
# ============================================

def hablar(texto):

    # Configuración del servicio de voz
    speech_config = speechsdk.SpeechConfig(
        subscription=speech_key,
        region=speech_region
    )

    # Selección de voz neuronal
    speech_config.speech_synthesis_voice_name = "es-ES-ElviraNeural"

    # Crea sintetizador de voz
    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config
    )

    # Reproduce el texto como audio
    synthesizer.speak_text_async(texto).get()


# ============================================
# BUCLE PRINCIPAL (MAIN LOOP)
# ============================================

# Loop infinito: el asistente nunca se detiene
while True:

    # 1. Escucha al usuario
    texto = escuchar()

    # 2. Si se reconoció algo...
    if texto:

        # 3. Enviar a GPT
        respuesta = preguntar_gpt(texto)

        # 4. Convertir respuesta a voz
        hablar(respuesta)