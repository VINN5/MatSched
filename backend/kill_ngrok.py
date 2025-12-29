# kill_ngrok.py
from pyngrok import ngrok

# Kill ALL active tunnels
ngrok.kill()
print("All ngrok tunnels killed!")