# test_ngrok.py
from pyngrok import ngrok

# Start tunnel
public_url = ngrok.connect(3000)
print("YOUR PUBLIC URL:")
print(public_url)
print("\nUPDATE .env WITH:")
print(f"MPESA_CALLBACK_URL={public_url}/api/mpesa/callback")