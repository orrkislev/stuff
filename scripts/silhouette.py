"""
Create a flat silhouette from a product photo.
- Removes near-white/near-light background
- Fills the subject with a solid color
- Places on solid #DDD6CA background
"""
import sys
from PIL import Image, ImageFilter
import numpy as np

def create_silhouette(input_path, output_path, fill_color, bg_color="#DDD6CA"):
    img = Image.open(input_path).convert("RGBA")
    arr = np.array(img)
    
    # Define background as light pixels (walls, floors)
    # Detect light pixels: high R, G, B and low saturation
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    max_channel = np.maximum(np.maximum(r, g), b)
    min_channel = np.minimum(np.minimum(r, g), b)
    saturation = max_channel - min_channel
    
    # Background = bright + low saturation (white/off-white walls, light floors)
    bg_mask = (max_channel > 140) & (saturation < 40)
    
    # Also catch very bright pixels
    bg_mask = bg_mask | ((r > 200) & (g > 200) & (b > 200))
    
    # Foreground = not background
    fg_mask = ~bg_mask
    
    # Clean up the mask with morphological operations (simple approach)
    fg_mask = np.array(fg_mask, dtype=np.uint8) * 255
    mask_img = Image.fromarray(fg_mask).filter(ImageFilter.MedianFilter(size=5))
    fg_mask = np.array(mask_img) > 127
    
    # Create output image
    result = Image.new("RGBA", img.size, bg_color)
    result_arr = np.array(result)
    
    # Fill foreground with the solid color
    fill_rgb = tuple(int(fill_color[i:i+2], 16) for i in (1, 3, 5))
    result_arr[fg_mask, 0] = fill_rgb[0]
    result_arr[fg_mask, 1] = fill_rgb[1]
    result_arr[fg_mask, 2] = fill_rgb[2]
    result_arr[fg_mask, 3] = 255
    
    # Save
    result = Image.fromarray(result_arr).convert("RGB")
    result.save(output_path, "JPEG", quality=90)
    print(f"Saved: {output_path}")

if __name__ == "__main__":
    inp = sys.argv[1]
    outp = sys.argv[2]
    color = sys.argv[3] if len(sys.argv) > 3 else "#245238"
    create_silhouette(inp, outp, color)
