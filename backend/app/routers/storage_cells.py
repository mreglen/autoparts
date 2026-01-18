from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.models.storage_cell import StorageCell as StorageCellModel
from app.models.storage_location import StorageLocation as StorageLocationModel
from app.models.product import Product as ProductModel
from app.models.product_storage_cell import ProductStorageCell as ProductStorageCellModel
from app.schemas.storage_cell import (
    StorageCell, StorageCellCreate, StorageCellUpdate,
    ProductStorageCell, ProductStorageCellCreate, ProductStorageCellUpdate,
    StorageCellWithLocation, StorageCellWithProducts
)
from app.db.database import get_db

router = APIRouter(prefix="/storage-cells", tags=["Storage Cells"])

# Storage Cell CRUD Operations

@router.post("/", response_model=StorageCell)
def create_storage_cell(cell: StorageCellCreate, db: Session = Depends(get_db)):
    """Create a new storage cell"""
    # Verify storage location exists
    storage_location = db.query(StorageLocationModel).filter(
        StorageLocationModel.id == cell.storage_location_id
    ).first()
    
    if not storage_location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    
    db_cell = StorageCellModel(**cell.dict())
    db.add(db_cell)
    db.commit()
    db.refresh(db_cell)
    return db_cell

@router.get("/{cell_id}", response_model=StorageCellWithLocation)
def read_storage_cell(cell_id: int, db: Session = Depends(get_db)):
    """Get storage cell by ID with storage location info"""
    cell = db.query(StorageCellModel).filter(StorageCellModel.id == cell_id).first()
    if not cell:
        raise HTTPException(status_code=404, detail="Storage cell not found")
    return cell

@router.get("/", response_model=List[StorageCell])
def read_storage_cells(
    storage_location_id: int = Query(None, alias="storage_location_id"),
    db: Session = Depends(get_db)
):
    """Get all storage cells, optionally filtered by storage location"""
    query = db.query(StorageCellModel)
    
    if storage_location_id:
        query = query.filter(StorageCellModel.storage_location_id == storage_location_id)
    
    cells = query.all()
    return cells

@router.put("/{cell_id}", response_model=StorageCell)
def update_storage_cell(
    cell_id: int, 
    cell_update: StorageCellUpdate, 
    db: Session = Depends(get_db)
):
    """Update storage cell"""
    db_cell = db.query(StorageCellModel).filter(StorageCellModel.id == cell_id).first()
    if not db_cell:
        raise HTTPException(status_code=404, detail="Storage cell not found")
    
    update_data = cell_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_cell, key, value)
    
    db.commit()
    db.refresh(db_cell)
    return db_cell

@router.delete("/{cell_id}", status_code=204)
def delete_storage_cell(cell_id: int, db: Session = Depends(get_db)):
    """Delete storage cell and all associated product links"""
    db_cell = db.query(StorageCellModel).filter(StorageCellModel.id == cell_id).first()
    if not db_cell:
        raise HTTPException(status_code=404, detail="Storage cell not found")
    
    # Delete all product-storage cell links first (handled by cascade)
    # This is redundant due to cascade="all, delete-orphan" but explicit for clarity
    product_links = db.query(ProductStorageCellModel).filter(
        ProductStorageCellModel.storage_cell_id == cell_id
    ).all()
    
    for link in product_links:
        db.delete(link)
    
    # Delete the storage cell
    db.delete(db_cell)
    db.commit()
    return

# Product Storage Cell Operations (Junction Table)

@router.post("/product-links/", response_model=ProductStorageCell)
def create_product_storage_cell_link(
    link: ProductStorageCellCreate, 
    db: Session = Depends(get_db)
):
    """Link a product to a storage cell"""
    # Verify product exists
    product = db.query(ProductModel).filter(ProductModel.id == link.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify storage cell exists
    cell = db.query(StorageCellModel).filter(StorageCellModel.id == link.storage_cell_id).first()
    if not cell:
        raise HTTPException(status_code=404, detail="Storage cell not found")
    
    # Check if link already exists
    existing_link = db.query(ProductStorageCellModel).filter(
        ProductStorageCellModel.product_id == link.product_id,
        ProductStorageCellModel.storage_cell_id == link.storage_cell_id
    ).first()
    
    if existing_link:
        raise HTTPException(status_code=400, detail="Product already linked to this storage cell")
    
    db_link = ProductStorageCellModel(**link.dict())
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link

@router.get("/product-links/", response_model=List[ProductStorageCell])
def read_product_storage_cell_links(
    product_id: int = Query(None, alias="product_id"),
    storage_cell_id: int = Query(None, alias="storage_cell_id"),
    db: Session = Depends(get_db)
):
    """Get product-storage cell links, optionally filtered"""
    query = db.query(ProductStorageCellModel)
    
    if product_id:
        query = query.filter(ProductStorageCellModel.product_id == product_id)
    
    if storage_cell_id:
        query = query.filter(ProductStorageCellModel.storage_cell_id == storage_cell_id)
    
    links = query.all()
    return links

@router.delete("/product-links/{link_id}", status_code=204)
def delete_product_storage_cell_link(link_id: int, db: Session = Depends(get_db)):
    """Delete product-storage cell link"""
    link = db.query(ProductStorageCellModel).filter(ProductStorageCellModel.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Product-storage cell link not found")
    
    db.delete(link)
    db.commit()
    return

# Get cells for specific storage location with product counts
@router.get("/by-location/{location_id}/with-products", response_model=List[StorageCellWithProducts])
def get_storage_cells_with_products(location_id: int, db: Session = Depends(get_db)):
    """Get all storage cells for a location with their associated products"""
    # Verify storage location exists
    storage_location = db.query(StorageLocationModel).filter(
        StorageLocationModel.id == location_id
    ).first()
    
    if not storage_location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    
    cells = db.query(StorageCellModel).filter(
        StorageCellModel.storage_location_id == location_id
    ).all()
    
    return cells

# Get all storage locations with their cells
@router.get("/locations-with-cells/")
def get_locations_with_cells(db: Session = Depends(get_db)):
    """Get all storage locations with their associated cells"""
    locations = db.query(StorageLocationModel).all()
    
    result = []
    for location in locations:
        cells = db.query(StorageCellModel).filter(
            StorageCellModel.storage_location_id == location.id
        ).all()
        
        location_data = {
            "id": location.id,
            "address": location.address,
            "organization_id": location.organization_id,
            "cells": [
                {
                    "id": cell.id,
                    "name": cell.name,
                    "description": cell.description
                } for cell in cells
            ]
        }
        result.append(location_data)
    
    return result