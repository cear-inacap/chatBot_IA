# ==============================
# 🧱 BASE: ROS2 JAZZY
# ==============================
FROM ros:jazzy

# Evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive


RUN apt update && apt upgrade -y
# ==============================
# 🔧 DEPENDENCIAS DEL SISTEMA
# ==============================
RUN apt update && apt install -y \
    python3-pip \
    alsa-utils \
    libasound2-dev \
    git \
    curl \
    nano \
    && rm -rf /var/lib/apt/lists/*

# ==============================
# 🐍 DEPENDENCIAS PYTHON
# ==============================
RUN pip install --no-cache-dir --break-system-packages \
    azure-cognitiveservices-speech \
    openai \
    python-dotenv

# ==============================
# 📁 WORKSPACE
# ==============================
WORKDIR /home/user

# Crear carpeta de trabajo
RUN mkdir -p /home/user/ros2_ws

# ==============================
# 🔊 CONFIGURACIÓN ALSA (IMPORTANTE)
# ==============================
# Esto puedes ajustarlo después según tu micrófono
RUN echo 'pcm.!default { type plug slave.pcm "hw:2,0" }' > /etc/asound.conf && \
    echo 'ctl.!default { type hw card 2 }' >> /etc/asound.conf

# ==============================
# 🔁 CARGAR ROS AUTOMÁTICAMENTE
# ==============================
RUN echo "source /opt/ros/jazzy/setup.bash" >> /root/.bashrc

# ==============================
# 🚀 COMANDO POR DEFECTO
# ==============================
CMD ["bash"]