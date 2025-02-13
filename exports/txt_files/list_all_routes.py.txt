from app import app  # Import your Flask app instance from the main application package

with app.app_context():  # Ensure the application context is active
    for rule in app.url_map.iter_rules():
        print(f"Endpoint: {rule.endpoint}, Methods: {rule.methods}, Rule: {rule.rule}")