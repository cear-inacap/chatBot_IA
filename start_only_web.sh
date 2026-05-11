#!/bin/bash

export DISPLAY=:0
export XAUTHORITY=/home/ar4/.Xauthority

cd /home/ar4/inabot/ros2_ws/web || exit

python3 -m http.server 8000 &
SERVER_PID=$!

echo "Presiona Ctrl+C para cerrar todo"

# 👇 captura Ctrl+C
trap "echo 'Cerrando...'; pkill -f http.server; pkill chromium; exit" INT

# mantener script vivo
while true; do sleep 1; done