#!/usr/bin/env python3
"""
Script to check video processing status in database
Run this on your Linux server:
python3 check_video_status.py {product_id}
"""

import sys
import os

# Add backend to path
sys.path.insert(0, '/home/fast/autoparts/backend')

# Set environment variable for config
os.environ.setdefault('DATABASE_URL', 'postgresql://user:password@localhost/dbname')

from app.db.database import SessionLocal
from app.models.product import ProductVideo
from app.models.product import Product as ProductModel

def check_video_status(product_id: int):
    db = SessionLocal()
    try:
        # Get product
        product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        if not product:
            print(f"❌ Product {product_id} not found")
            return
        
        print(f"✅ Product found: {product.name}")
        print(f"   Organization ID: {product.organization_id}")
        
        # Get videos
        videos = db.query(ProductVideo).filter(ProductVideo.product_id == product_id).all()
        
        if not videos:
            print(f"⚠️  No videos found for product {product_id}")
            return
        
        print(f"\n📹 Found {len(videos)} video(s):\n")
        
        for video in videos:
            print(f"Video ID: {video.id}")
            print(f"   Video URL: {video.video_url}")
            print(f"   Processing Status: {video.processing_status}")
            print(f"   Created: {video.created_at}")
            print(f"   Updated: {video.updated_at}")
            
            # Check if temp or final path
            if video.video_url.startswith('/temp/'):
                print(f"   ⚠️  STILL IN TEMP - Not processed yet!")
            elif video.video_url.startswith('/videos/'):
                print(f"   ✅ PROCESSED - Final video path")
            else:
                print(f"   ❓ Unknown path format")
            
            print("-" * 50)
        
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 check_video_status.py {product_id}")
        print("Example: python3 check_video_status.py 9")
        sys.exit(1)
    
    product_id = int(sys.argv[1])
    check_video_status(product_id)
