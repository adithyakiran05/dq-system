import os
from strands.models.openai import OpenAIModel

def load_model() -> OpenAIModel:
    """Get Groq model client using OpenAI compatibility."""
    return OpenAIModel(
        model_id="llama-3.3-70b-versatile"
    )
