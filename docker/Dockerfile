# ==============================
# 🧱 BASE: ROS2 JAZZY
# ==============================
FROM ros:jazzy

ENV DEBIAN_FRONTEND=noninteractive

# ==============================
# 🔧 DEPENDENCIAS DEL SISTEMA
# ==============================
RUN apt update && apt upgrade -y && \
    apt install -y \
    python3-pip \
    python3-venv \
    alsa-utils \
    libasound2-dev \
    git \
    curl \
    nano \
    vim \
    && rm -rf /var/lib/apt/lists/*

# ==============================
# 🐍 DEPENDENCIAS PYTHON
# ==============================
RUN pip install --no-cache-dir --break-system-packages \
    azure-cognitiveservices-speech \
    openai \
    python-dotenv \
    websocket-client

# ==============================
# 📁 WORKDIR
# ==============================
WORKDIR /workspace

# ==============================
# 🔊 ALSA
# ==============================
RUN echo 'pcm.!default { type plug slave.pcm "hw:2,0" }' > /etc/asound.conf && \
    echo 'ctl.!default { type hw card 2 }' >> /etc/asound.conf

# ==============================
# 🔁 ROS ENV
# ==============================
RUN echo "source /opt/ros/jazzy/setup.bash" >> /root/.bashrc

# ==============================
# 🚀 DEFAULT
# ==============================
CMD ["bash"]