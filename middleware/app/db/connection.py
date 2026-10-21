import queue
import time
import logging
import pg8000
from contextlib import contextmanager
from app.config import settings

logger = logging.getLogger("middleware.db.pool")

class DatabaseConnectionPool:
    """
    High-performance Connection Pool for pg8000.
    Eliminates the ~2.5s TCP+TLS handshake and transaction latency by
    keeping persistent, reusable database connections with autocommit=True.
    """
    def __init__(self, pool_size=10, max_idle_seconds=120):
        self.pool_size = pool_size
        self.max_idle_seconds = max_idle_seconds
        self._pool = queue.Queue(maxsize=pool_size)

    def _create_raw_connection(self):
        conn = pg8000.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            timeout=10
        )
        conn.autocommit = True
        return conn

    def warmup(self, count=3):
        """Pre-warm connections at application startup."""
        logger.info(f"Pre-warming {count} RDS database connections...")
        for _ in range(min(count, self.pool_size)):
            try:
                conn = self._create_raw_connection()
                self._pool.put_nowait((conn, time.time()))
            except Exception as e:
                logger.warning(f"Could not pre-warm connection: {e}")
                break
        logger.info(f"Database connection pool ready with {self._pool.qsize()} warm connections.")

    def acquire(self):
        """
        Gets a connection from the pool in 0ms.
        Recycles idle connections older than max_idle_seconds.
        """
        while not self._pool.empty():
            try:
                conn, last_used = self._pool.get_nowait()
                if time.time() - last_used > self.max_idle_seconds or getattr(conn, "_sock", None) is None:
                    try:
                        conn.close()
                    except Exception:
                        pass
                    continue
                return conn
            except queue.Empty:
                break
        return self._create_raw_connection()

    def release(self, conn, discard=False):
        """
        Returns connection back to the pool for reuse, or closes it if discarded.
        """
        if not conn:
            return
            
        if discard:
            try:
                conn.close()
            except Exception:
                pass
            return

        try:
            self._pool.put_nowait((conn, time.time()))
        except queue.Full:
            try:
                conn.close()
            except Exception:
                pass

db_pool = DatabaseConnectionPool(pool_size=10)

@contextmanager
def get_db_cursor():
    """
    Context manager that acquires a pooled connection in 0ms,
    yields a cursor, and safely returns it to the pool.
    """
    conn = None
    has_error = False
    try:
        conn = db_pool.acquire()
        cur = conn.cursor()
        yield cur
    except Exception as e:
        has_error = True
        logger.warning(f"Database operation failed: {e}")
        raise
    finally:
        if conn:
            db_pool.release(conn, discard=has_error)

def fetch_all_as_dicts(cur):
    if not cur.description:
        return []
    columns = [desc[0] for desc in cur.description]
    rows = cur.fetchall()
    return [dict(zip(columns, row)) for row in rows]

def fetch_one_as_dict(cur):
    if not cur.description:
        return None
    columns = [desc[0] for desc in cur.description]
    row = cur.fetchone()
    if not row:
        return None
    return dict(zip(columns, row))
