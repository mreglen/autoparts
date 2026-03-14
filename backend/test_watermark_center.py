"""
Test Watermark Center Positioning
==================================
This script tests that the watermark appears in the CENTER of the image.
"""

from PIL import Image
from io import BytesIO
import os


def add_watermark_test(image: Image.Image, logo_path: str) -> Image.Image:
    """Apply watermark with center positioning"""
    try:
        # Open the logo
        logo = Image.open(logo_path)
        
        # Convert both images to RGBA for transparency support
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        if logo.mode != 'RGBA':
            logo = logo.convert('RGBA')
        
        # Calculate logo size (max 160% of image width or height)
        max_logo_width = int(image.width * 1.60)
        max_logo_height = int(image.height * 1.60)
        
        # Resize logo while maintaining aspect ratio
        logo.thumbnail((max_logo_width, max_logo_height), Image.Resampling.LANCZOS)
        
        # Make logo semi-transparent (50% opacity)
        alpha = logo.split()[3]  # Get the alpha channel
        alpha = alpha.point(lambda i: i * 0.5)
        logo.putalpha(alpha)
        
        # Create a transparent layer for the watermark
        watermark_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
        
        # Position: EXACTLY center of the image
        center_x = image.width / 2
        center_y = image.height / 2
        
        # Calculate top-left corner so that logo center aligns with image center
        x = int(center_x - logo.width / 2)
        y = int(center_y - logo.height / 2)
        
        print(f"✓ Watermark Calculation:")
        print(f"  Image dimensions: {image.width}x{image.height}")
        print(f"  Logo dimensions: {logo.width}x{logo.height}")
        print(f"  Image center: ({center_x}, {center_y})")
        print(f"  Logo half-size: ({logo.width/2}, {logo.height/2})")
        print(f"  Top-left position: ({x}, {y})")
        print(f"  Logo center will be at: ({x + logo.width/2}, {y + logo.height/2})")
        
        # Paste logo onto watermark layer
        watermark_layer.paste(logo, (x, y), logo)
        
        # Composite the watermark onto the original image
        watermarked_image = Image.alpha_composite(image, watermark_layer)
        
        print(f"\n✓ Watermark applied successfully!")
        print(f"  Final position: ({x}, {y}) - CENTERED with 50% transparency")
        
        return watermarked_image
        
    except Exception as e:
        print(f"⚠️ Error applying watermark: {str(e)}")
        return image


def main():
    print("=" * 70)
    print("WATERMARK CENTER POSITIONING TEST")
    print("=" * 70)
    
    # Step 1: Find logo
    logo_dirs = [
        "uploads/logo_organizations/qMHbBIoD51",
        "../uploads/logo_organizations/qMHbBIoD51"
    ]
    
    logo_path = None
    for logo_dir in logo_dirs:
        if os.path.exists(logo_dir):
            for file in os.listdir(logo_dir):
                if file.endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    logo_path = os.path.join(logo_dir, file)
                    break
        if logo_path:
            break
    
    if not logo_path:
        print("❌ No logo found. Please ensure you have a logo in uploads/logo_organizations/")
        return
    
    print(f"\n✓ Found logo: {logo_path}")
    
    # Step 2: Create test image (1920x1080 - common photo size)
    print(f"\n✓ Creating test image (1920x1080)...")
    test_image = Image.new('RGB', (1920, 1080), color=(200, 200, 200))
    
    # Draw a crosshair in the center to verify alignment
    draw = ImageDraw.Draw(test_image)
    # Vertical line through center
    draw.line((960, 0, 960, 1080), fill=(255, 0, 0), width=2)
    # Horizontal line through center
    draw.line((0, 540, 1920, 540), fill=(255, 0, 0), width=2)
    # Circle at center
    draw.ellipse((950, 530, 970, 550), fill=(255, 0, 0))
    
    test_image.save("test_original_with_crosshair.png")
    print(f"✓ Test image saved: test_original_with_crosshair.png")
    print(f"  Red crosshair marks the exact center")
    
    # Step 3: Apply watermark
    print(f"\n✓ Applying watermark...")
    watermarked_image = add_watermark_test(test_image, logo_path)
    
    # Step 4: Save result
    watermarked_image_rgb = watermarked_image.convert('RGB')
    watermarked_image_rgb.save("test_watermarked_centered.png")
    print(f"\n✓ Watermarked image saved: test_watermarked_centered.png")
    
    print(f"\n" + "=" * 70)
    print("VERIFICATION INSTRUCTIONS:")
    print("=" * 70)
    print(f"1. Open 'test_watermarked_centered.png'")
    print(f"2. The watermark should be CENTERED on the red crosshair")
    print(f"3. The logo center should align with the intersection of red lines")
    print(f"4. Logo should be large (up to 160% of image width/height)")
    print(f"5. Logo should be semi-transparent (50% opacity)")
    print("=" * 70)


if __name__ == "__main__":
    from PIL import ImageDraw
    main()
