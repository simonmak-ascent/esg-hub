#!/usr/bin/env python3
"""
Generate vector embeddings for ESG Hub pages and external resources,
then store them in SurrealDB with HNSW indexes for semantic search.

Model: BAAI/bge-small-en-v1.5 (384 dimensions)
"""

import json
import time
import sys
import os
import base64
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# SurrealDB connection
SURREAL_URL = os.environ.get("SURREAL_URL", "")
SURREAL_USERNAME = "root"
SURREAL_PASSWORD = os.environ.get("SURREAL_PASSWORD", "")
SURREAL_NAMESPACE = "esg_hub"
SURREAL_DATABASE = "main"

EMBEDDING_DIM = 384
BATCH_SIZE = 32  # How many texts to embed at once
MAX_TEXT_LENGTH = 2000  # Truncate content for embedding (first N chars)


def surreal_query(sql):
    """Execute a SurrealQL query via HTTP."""
    auth = base64.b64encode(f"{SURREAL_USERNAME}:{SURREAL_PASSWORD}".encode()).decode()
    req = Request(
        f"{SURREAL_URL}/sql",
        data=sql.encode("utf-8"),
        headers={
            "Content-Type": "text/plain",
            "Accept": "application/json",
            "surreal-ns": SURREAL_NAMESPACE,
            "surreal-db": SURREAL_DATABASE,
            "Authorization": f"Basic {auth}",
        },
        method="POST",
    )
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        print(f"SurrealDB error {e.code}: {e.read().decode()}")
        raise


def setup_schema():
    """Add embedding field and HNSW index to page and external_resource tables."""
    print("Setting up vector schema...")
    
    schema_sql = f"""
-- Add embedding field to page table
DEFINE FIELD IF NOT EXISTS embedding ON page TYPE option<array<float>>;

-- Add embedding field to external_resource table  
DEFINE FIELD IF NOT EXISTS embedding ON external_resource TYPE option<array<float>>;

-- Create HNSW vector indexes
DEFINE INDEX IF NOT EXISTS idx_page_embedding ON page FIELDS embedding HNSW DIMENSION {EMBEDDING_DIM} DIST COSINE;
DEFINE INDEX IF NOT EXISTS idx_ext_embedding ON external_resource FIELDS embedding HNSW DIMENSION {EMBEDDING_DIM} DIST COSINE;
"""
    results = surreal_query(schema_sql)
    for r in results:
        if r["status"] != "OK":
            print(f"  Schema error: {json.dumps(r)}")
        else:
            print(f"  OK: {r['time']}")
    print("Vector schema setup complete.")


def get_pages():
    """Fetch all pages from SurrealDB."""
    results = surreal_query(
        "SELECT id, title, description, content, section, permalink FROM page;"
    )
    return results[0]["result"]


def get_external_resources():
    """Fetch all external resources from SurrealDB."""
    results = surreal_query(
        "SELECT id, title, content, source_domain, url FROM external_resource;"
    )
    return results[0]["result"]


def prepare_text_for_embedding(record, record_type="page"):
    """Prepare text for embedding by combining title + description + content snippet."""
    parts = []
    
    if record.get("title"):
        parts.append(record["title"])
    
    if record_type == "page":
        if record.get("description"):
            parts.append(record["description"])
        if record.get("section"):
            parts.append(f"Section: {record['section']}")
    elif record_type == "external":
        if record.get("source_domain"):
            parts.append(f"Source: {record['source_domain']}")
    
    if record.get("content"):
        # Take first N chars of content, stripping markdown
        content = record["content"][:MAX_TEXT_LENGTH]
        # Basic markdown stripping
        for char in ["#", "*", "_", "`", "[", "]", "(", ")"]:
            content = content.replace(char, " ")
        # Collapse whitespace
        content = " ".join(content.split())
        parts.append(content)
    
    return " ".join(parts)


def generate_embeddings_batch(texts):
    """Generate embeddings for a batch of texts using fastembed."""
    from fastembed import TextEmbedding
    
    if not hasattr(generate_embeddings_batch, "_model"):
        print("Loading embedding model (BAAI/bge-small-en-v1.5)...")
        generate_embeddings_batch._model = TextEmbedding("BAAI/bge-small-en-v1.5")
        print("Model loaded.")
    
    model = generate_embeddings_batch._model
    embeddings = list(model.embed(texts))
    return [emb.tolist() for emb in embeddings]


def update_embeddings(record_id, embedding):
    """Update a record with its embedding vector."""
    # Format the embedding as a SurrealQL array
    emb_str = "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"
    sql = f"UPDATE {record_id} SET embedding = {emb_str};"
    results = surreal_query(sql)
    if results[0]["status"] != "OK":
        print(f"  Error updating {record_id}: {json.dumps(results[0])}")
        return False
    return True


def main():
    print("=" * 60)
    print("ESG Hub Vector Embedding Generator")
    print("=" * 60)
    
    # Step 1: Setup schema
    setup_schema()
    
    # Step 2: Fetch all records
    print("\nFetching pages from SurrealDB...")
    pages = get_pages()
    print(f"  Found {len(pages)} pages")
    
    print("Fetching external resources from SurrealDB...")
    ext_resources = get_external_resources()
    print(f"  Found {len(ext_resources)} external resources")
    
    # Step 3: Prepare texts
    print("\nPreparing texts for embedding...")
    page_texts = []
    page_ids = []
    for p in pages:
        text = prepare_text_for_embedding(p, "page")
        if text.strip():
            page_texts.append(text)
            page_ids.append(p["id"])
    
    ext_texts = []
    ext_ids = []
    for e in ext_resources:
        text = prepare_text_for_embedding(e, "external")
        if text.strip():
            ext_texts.append(text)
            ext_ids.append(e["id"])
    
    print(f"  {len(page_texts)} page texts ready")
    print(f"  {len(ext_texts)} external resource texts ready")
    
    # Step 4: Generate and store embeddings for pages
    print(f"\nGenerating embeddings for {len(page_texts)} pages...")
    total_pages = len(page_texts)
    errors = 0
    
    for i in range(0, total_pages, BATCH_SIZE):
        batch_texts = page_texts[i:i + BATCH_SIZE]
        batch_ids = page_ids[i:i + BATCH_SIZE]
        
        try:
            embeddings = generate_embeddings_batch(batch_texts)
            
            for record_id, embedding in zip(batch_ids, embeddings):
                if not update_embeddings(record_id, embedding):
                    errors += 1
            
            done = min(i + BATCH_SIZE, total_pages)
            print(f"  Pages: {done}/{total_pages} ({errors} errors)")
        except Exception as e:
            print(f"  Error in batch {i}: {e}")
            errors += len(batch_texts)
    
    print(f"  Pages complete: {total_pages - errors} success, {errors} errors")
    
    # Step 5: Generate and store embeddings for external resources
    print(f"\nGenerating embeddings for {len(ext_texts)} external resources...")
    total_ext = len(ext_texts)
    errors = 0
    
    for i in range(0, total_ext, BATCH_SIZE):
        batch_texts = ext_texts[i:i + BATCH_SIZE]
        batch_ids = ext_ids[i:i + BATCH_SIZE]
        
        try:
            embeddings = generate_embeddings_batch(batch_texts)
            
            for record_id, embedding in zip(batch_ids, embeddings):
                if not update_embeddings(record_id, embedding):
                    errors += 1
            
            done = min(i + BATCH_SIZE, total_ext)
            print(f"  External: {done}/{total_ext} ({errors} errors)")
        except Exception as e:
            print(f"  Error in batch {i}: {e}")
            errors += len(batch_texts)
    
    print(f"  External complete: {total_ext - errors} success, {errors} errors")
    
    # Step 6: Verify
    print("\nVerifying embeddings...")
    verify_results = surreal_query(
        "SELECT count() as cnt FROM page WHERE embedding IS NOT NONE GROUP ALL;"
    )
    page_count = verify_results[0]["result"][0]["cnt"] if verify_results[0]["result"] else 0
    
    verify_ext = surreal_query(
        "SELECT count() as cnt FROM external_resource WHERE embedding IS NOT NONE GROUP ALL;"
    )
    ext_count = verify_ext[0]["result"][0]["cnt"] if verify_ext[0]["result"] else 0
    
    print(f"  Pages with embeddings: {page_count}")
    print(f"  External resources with embeddings: {ext_count}")
    
    # Step 7: Test semantic search
    print("\nTesting semantic search...")
    test_query = "climate change carbon emissions greenhouse gas"
    test_emb = generate_embeddings_batch([test_query])[0]
    emb_str = "[" + ",".join(f"{v:.8f}" for v in test_emb) + "]"
    
    search_sql = f"""
SELECT id, title, permalink, vector::distance::knn() AS distance
FROM page
WHERE embedding <|5, 100|> {emb_str}
ORDER BY distance
LIMIT 5;
"""
    search_results = surreal_query(search_sql)
    if search_results[0]["status"] == "OK":
        print("  Top 5 results for 'climate change carbon emissions':")
        for r in search_results[0]["result"]:
            print(f"    {r['distance']:.4f} - {r['title']} ({r.get('permalink', 'N/A')})")
    else:
        print(f"  Search error: {json.dumps(search_results[0])}")
    
    print("\n" + "=" * 60)
    print("Embedding generation complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
