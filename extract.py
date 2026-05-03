import cv2
import numpy as np
from rembg import remove
import glob
import os

os.makedirs('public/assets/products', exist_ok=True)

images = ['menu1_1.jpg', 'menu1_2.jpg', 'menu1_3.jpg', 'menu2_1.jpg']

for img_path in images:
    if not os.path.exists(img_path):
        print(f"File {img_path} not found.")
        continue
        
    print(f"Processing {img_path}...")
    
    # Read the image
    img = cv2.imread(img_path)
    
    # Remove background
    # We pass the image as byte array or directly as numpy array
    # rembg remove() accepts numpy arrays in RGB
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result_rgba = remove(img_rgb)
    
    # Convert back to BGRA for saving with cv2
    result_bgra = cv2.cvtColor(result_rgba, cv2.COLOR_RGBA2BGRA)
    
    # Extract the alpha channel
    alpha = result_bgra[:, :, 3]
    
    # Threshold the alpha channel to create a binary mask
    _, mask = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"Found {len(contours)} total contours in {img_path}.")
    
    # Filter contours by size
    min_area = 20000 # Minimum area to be considered a product
    valid_contours = [c for c in contours if cv2.contourArea(c) > min_area]
    
    print(f"Found {len(valid_contours)} valid product contours in {img_path}.")
    
    base_name = os.path.splitext(os.path.basename(img_path))[0]
    
    for i, c in enumerate(valid_contours):
        x, y, w, h = cv2.boundingRect(c)
        
        # Add a little padding if possible
        padding = 10
        x_start = max(0, x - padding)
        y_start = max(0, y - padding)
        x_end = min(img.shape[1], x + w + padding)
        y_end = min(img.shape[0], y + h + padding)
        
        # Crop the image with alpha channel
        cropped = result_bgra[y_start:y_end, x_start:x_end]
        
        # Save the cropped product
        out_path = f"public/assets/products/{base_name}_product_{i}.png"
        cv2.imwrite(out_path, cropped)
        print(f"Saved {out_path}")
