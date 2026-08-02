import os
import logging
from mcp.client.stdio import stdio_client, get_default_environment
from mcp.client.stdio import StdioServerParameters
from strands.tools.mcp.mcp_client import MCPClient

logger = logging.getLogger(__name__)

def get_streamable_http_mcp_client() -> MCPClient:
    """Returns an MCP Client compatible with Strands"""
    server_params = StdioServerParameters(
        command="C:\\Users\\Adithya\\AppData\\Roaming\\Python\\Python314\\Scripts\\uv.exe",
        args=["run", "server.py"],
        env=get_default_environment(),
        cwd="C:\\Users\\Adithya\\Desktop\\dq-system\\dqmcp"
    )
    return MCPClient(lambda: stdio_client(server_params))
