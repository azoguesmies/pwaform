"""
PWA Form Backend - Python Server
Recibe datos del formulario PWA y los guarda en Google Sheets
Reemplazo del Google Apps Script original
"""

import os
import json
import logging
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS
import gspread
from google.oauth2.service_account import Credentials

# ─── Configuración ───────────────────────────────────────────────────────────

# Variables de entorno (crea un archivo .env o configúralas en el sistema)
SHEET_NAME = os.getenv("SHEET_NAME", "PWA Form Responses")
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS", "credentials.json")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 5000))

# Inicializar Flask
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ─── Google Sheets ───────────────────────────────────────────────────────────

def get_sheet():
    """Conecta con Google Sheets usando credenciales de cuenta de servicio."""
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(SHEET_NAME).sheet1
    return sheet

def ensure_headers(sheet):
    """Crea encabezados si la hoja está vacía."""
    if sheet.row_count == 0 or not sheet.get_all_values():
        headers = [
            "Timestamp", "Name", "Address", "Email",
            "Latitude", "Longitude", "Photo URL"
        ]
        sheet.append_row(headers)
        log.info("Encabezados creados en la hoja")

# ─── Rutas API ───────────────────────────────────────────────────────────────

@app.route("/api/submit", methods=["POST", "OPTIONS"])
def submit():
    """Recibe datos del formulario y los guarda en Google Sheets."""

    # Responder a preflight OPTIONS para CORS (Flask-CORS ya lo maneja,
    # pero se deja explícito por claridad)
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(force=True)
        log.info(f"Datos recibidos: name={data.get('name')}, email={data.get('email')}")

        # Validar campos obligatorios
        required = ["name", "address", "email"]
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({
                "result": "error",
                "message": f"Faltan campos obligatorios: {', '.join(missing)}"
            }), 400

        # Conectar con Google Sheets
        sheet = get_sheet()
        ensure_headers(sheet)

        # Preparar fila (mismo orden que en el Apps Script original)
        row = [
            datetime.now().isoformat(),      # Timestamp
            data.get("name", ""),            # Name
            data.get("address", ""),         # Address
            data.get("email", ""),           # Email
            data.get("lat", ""),             # Latitude
            data.get("lon", ""),             # Longitude
            data.get("photo", ""),           # Photo URL (cadena base64 o URL)
        ]

        sheet.append_row(row)
        log.info("Fila agregada correctamente")

        return jsonify({
            "result": "success",
            "message": "Formulario enviado correctamente",
        }), 200

    except FileNotFoundError:
        log.error(f"Archivo de credenciales no encontrado: {CREDENTIALS_FILE}")
        return jsonify({
            "result": "error",
            "message": "Error de configuración del servidor (credentials)"
        }), 500

    except gspread.exceptions.SpreadsheetNotFound:
        log.error(f"Hoja de cálculo no encontrada: {SHEET_NAME}")
        return jsonify({
            "result": "error",
            "message": f"No se encontró la hoja '{SHEET_NAME}'"
        }), 500

    except Exception as e:
        log.exception("Error inesperado")
        return jsonify({
            "result": "error",
            "message": str(e)
        }), 500

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "PWA Form Backend",
        "version": "1.0",
        "endpoint": "/api/submit"
    })

# ─── Requisitos ──────────────────────────────────────────────────────────────

REQUIREMENTS = """
flask>=3.0
flask-cors>=4.0
gspread>=6.0
google-auth>=2.0
"""

# ─── Inicio ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"🚀 Servidor iniciado en http://{HOST}:{PORT}")
    print(f"📡 Endpoint POST: http://{HOST}:{PORT}/api/submit")
    print(f"\n📌 Para usar con tu PWA:")
    print(f"   En script.js, función syncRecord, cambia la URL de fetch por:")
    print(f"   http://localhost:{PORT}/api/submit  (desarrollo)")
    print(f"   o https://tudominio.com/api/submit  (producción)")
    app.run(host=HOST, port=PORT, debug=True)
