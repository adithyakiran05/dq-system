FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# AgentCore requires the web server to listen on port 8080 by default (or as configured)
EXPOSE 8080

CMD ["python", "agent.py"]
