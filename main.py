from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
VIEWS_DIR = BASE_DIR / "views"

load_dotenv(BASE_DIR / ".env")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    from flight import flight_bp
    from hotel import hotel_bp
    from planner import planner_bp

    app.register_blueprint(flight_bp)
    app.register_blueprint(hotel_bp)
    app.register_blueprint(planner_bp)

    @app.route("/")
    def index():
        return send_from_directory(VIEWS_DIR, "index.html")

    @app.route("/index.html")
    def index_file():
        return send_from_directory(VIEWS_DIR, "index.html")

    @app.route("/results.html")
    def results_file():
        return send_from_directory(VIEWS_DIR, "results.html")

    @app.route("/hotel-results.html")
    def hotel_results_file():
        return send_from_directory(VIEWS_DIR, "hotel-results.html")

    @app.route("/planner-results.html")
    def planner_results_file():
        return send_from_directory(VIEWS_DIR, "planner-results.html")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
