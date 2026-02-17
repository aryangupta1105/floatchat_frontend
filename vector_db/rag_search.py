# floatchat/vectordb/rag_search.py

from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
from groq import Groq
from dotenv import load_dotenv
import os
import time

# ---------------------------------------------------
# 1. Load Environment
# ---------------------------------------------------
load_dotenv()

GROQ_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_KEY:
    print("❌ ERROR: GROQ_API_KEY not found.")
    exit()

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
print(f"🧠 Using Groq model: {GROQ_MODEL}")

groq_client = Groq(api_key=GROQ_KEY)

# ---------------------------------------------------
# 2. Load Unified Chroma Vector DB
# ---------------------------------------------------
VECTOR_DB_PATH = "./floatchat/vectordb/chroma_vector_db"
client = PersistentClient(path=VECTOR_DB_PATH)

try:
    collection = client.get_collection("argo_profiles")
    print("✔ Loaded ChromaDB collection: argo_profiles")
except Exception as e:
    print("❌ ERROR loading vector DB:", e)
    exit()

# ---------------------------------------------------
# 3. Embedding Model
# ---------------------------------------------------
embedder = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")

# ---------------------------------------------------
# 4. Retrieve top-k relevant profiles
# ---------------------------------------------------
def retrieve_context(question: str, k: int = 5) -> str:
    query_emb = embedder.encode([question]).tolist()

    results = collection.query(
        query_embeddings=query_emb,
        n_results=k
    )

    docs = results["documents"][0]
    metas = results["metadatas"][0]
    ids = results["ids"][0]

    context = ""
    for i, (doc, meta, pid) in enumerate(zip(docs, metas, ids), start=1):
        context += f"\n--- Result {i} ---\n"
        context += f"Profile-key: {pid}\n"
        context += f"{doc}\n"
        context += f"Metadata: {meta}\n"

    print("\n🔹 Retrieved Context:\n", context)
    return context


# ---------------------------------------------------
# 5. Detect Core + BGC variables in user query
# ---------------------------------------------------
CORE_VARS = ["pressure", "temperature", "temp", "salinity", "sal"]
BGC_VARS = ["doxy", "oxygen", "chla", "chlorophyll", "bbp700", "bbp"]

def detect_variables(question: str):
    q = question.lower()
    core = any(v in q for v in CORE_VARS)
    bgc = any(v in q for v in BGC_VARS)
    return core, bgc


# ---------------------------------------------------
# 6. SQL Templates (LLM cannot change)
# ---------------------------------------------------
def build_sql_template(core: bool, bgc: bool):
    
    if core and not bgc:
        return """
SELECT 
    level_index,
    pressure,
    temperature,
    temperature_adjusted,
    salinity,
    salinity_adjusted
FROM core_levels
WHERE profile_key = '{PROFILE_KEY}'
ORDER BY level_index;
"""

    if bgc and not core:
        return """
SELECT 
    level_index,
    doxy,
    chla,
    bbp700
FROM bgc_levels
WHERE profile_key = '{PROFILE_KEY}'
ORDER BY level_index;
"""

    if core and bgc:
        return """
SELECT 
    cl.level_index,
    cl.pressure,
    cl.temperature,
    cl.temperature_adjusted,
    cl.salinity,
    cl.salinity_adjusted,
    bgc.doxy,
    bgc.chla,
    bgc.bbp700
FROM core_levels cl
LEFT JOIN bgc_levels bgc
    ON cl.profile_key = bgc.profile_key
   AND cl.level_index = bgc.level_index
WHERE cl.profile_key = '{PROFILE_KEY}'
ORDER BY cl.level_index;
"""

    return None


# ---------------------------------------------------
# 7. SAFE SQL CHECKER — LLM BLOCKED
# ---------------------------------------------------
def llm_safe_sql(sql_template: str, question: str, context: str):
    """
    LLM is NOT allowed to change SQL logic.
    SQL templates are trusted.
    This function only returns the SQL unchanged.
    """
    return sql_template


# ---------------------------------------------------
# 8. RAG → SQL Pipeline
# ---------------------------------------------------
def rag_answer(question: str) -> str:

    core_needed, bgc_needed = detect_variables(question)
    print(f"🔍 Core needed: {core_needed}, BGC needed: {bgc_needed}")

    sql_template = build_sql_template(core_needed, bgc_needed)

    if sql_template is None:
        return "The data does not contain this information."

    context = retrieve_context(question)

    # Select best matching profile_key
    result = collection.query(
        query_embeddings=embedder.encode([question]).tolist(),
        n_results=1
    )
    profile_key = result["ids"][0][0]

    sql_filled = sql_template.replace("{PROFILE_KEY}", str(profile_key))

    # LLM only checks syntax — but returns unchanged
    final_sql = llm_safe_sql(sql_filled, question, context)

    print("\n🧠 Final SQL:\n", final_sql)
    return final_sql


# ---------------------------------------------------
# 9. Manual Test
# ---------------------------------------------------
if __name__ == "__main__":
    test_q = "Show me temperature and DOXY values for float 1900042"
    print("\n🔎 QUESTION:", test_q)
    sql_query = rag_answer(test_q)
    print("\n📌 FINAL SQL QUERY:\n")
    print(sql_query)
