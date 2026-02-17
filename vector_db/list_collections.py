from chromadb import PersistentClient

client = PersistentClient(path="./floatchat/vectordb/chroma_vector_db")

collections = client.list_collections()

print("\n📌 Collections inside Chroma DB:\n")

if not collections:
    print("❌ No collections found. Your vector DB is empty.")
else:
    for c in collections:
        print("✔", c.name)
