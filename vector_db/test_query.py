from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer

# 1) Load Chroma client with correct DB path
client = PersistentClient(path="./floatchat/vectordb/chroma_vector_db")

# 2) Load your collection
collection = client.get_collection("argo_profiles")

# 3) Load the SAME embedding model used in build_vector_db
model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")

# 4) Query text
query = "ocean temperature near surface"

# 5) Convert query text into embedding
query_emb = model.encode([query]).tolist()

# 6) Run vector search
results = collection.query(
    query_embeddings=query_emb,
    n_results=3
)

# 7) Print results
print("\n🔍 Top 3 matches:")
for i, doc in enumerate(results["documents"][0]):
    print(f"\nResult {i+1}:")
    print(doc)
    print("Metadata:", results["metadatas"][0][i])
