"""Official Demo-only product secret (must match client config).

Client config (签发侧) must include:
  ai.workspace.third.platform.secret=third-party-integration-demo-python:1234

Do NOT use this value in production plugins.
"""

DEMO_PRODUCT_SECRET = "1234"
DEMO_EXTENSION_NAME = "third-party-integration-demo-python"
DEMO_CLIENT_CONFIG_ENTRY = f"{DEMO_EXTENSION_NAME}:{DEMO_PRODUCT_SECRET}"
