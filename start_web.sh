#!/bin/bash

export DISPLAY=:0
export XAUTHORITY=/home/jetson/.Xauthority

cd /home/jetson/proyectos/chatBot_IA/frontend || exit

python3 -m http.server 8000 &
SERVER_PID=$!

sleep 2

firefox --kiosk http://localhost:8000 &

BROWSER_PID=$!

echo "Presiona Ctrl+C para cerrar todo"

trap "echo 'Cerrando...'; kill $SERVER_PID; kill $BROWSER_PID; exit" INT

while true; do
    sleep 1
done