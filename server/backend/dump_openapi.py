import json
import os
import sys

# Add app directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

with open("openapi.json", "w") as f:
    json.dump(app.openapi(), f, indent=2)
print("Successfully dumped openapi.json")
