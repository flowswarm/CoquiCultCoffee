import cv2
import numpy as np
import glob
import os

images = glob.glob('public/assets/products/*.png')
for img_path in images:
    if "_split_" in img_path: continue
    
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    if img is None or img.shape[2] != 4: continue
    
    alpha = img[:, :, 3]
    
    # Calculate vertical projection
    col_sums = np.sum(alpha, axis=0)
    
    # Find continuous blocks of non-zero alpha columns
    threshold = 50 * 255 # At least 50 solid pixels in a column to be part of an object
    is_obj = col_sums > threshold
    
    # Find starts and ends of objects
    diffs = np.diff(is_obj.astype(int))
    starts = np.where(diffs == 1)[0] + 1
    ends = np.where(diffs == -1)[0] + 1
    
    if is_obj[0]: starts = np.insert(starts, 0, 0)
    if is_obj[-1]: ends = np.append(ends, len(is_obj))
    
    print(f"{img_path}: found {len(starts)} objects horizontally")
    
    # If it's just 1 object, it might be arranged vertically (like menu1_2.jpg)
    if len(starts) == 1:
        row_sums = np.sum(alpha, axis=1)
        row_is_obj = row_sums > threshold
        diffs = np.diff(row_is_obj.astype(int))
        r_starts = np.where(diffs == 1)[0] + 1
        r_ends = np.where(diffs == -1)[0] + 1
        
        if row_is_obj[0]: r_starts = np.insert(r_starts, 0, 0)
        if row_is_obj[-1]: r_ends = np.append(r_ends, len(row_is_obj))
        
        print(f"  found {len(r_starts)} objects vertically")
        
        if len(r_starts) > 1:
            for i, (r_s, r_e) in enumerate(zip(r_starts, r_ends)):
                if r_e - r_s > 50: # valid height
                    cropped = img[r_s:r_e, :]
                    
                    # Trim transparent edges tightly
                    c_alpha = cropped[:, :, 3]
                    c_cols = np.where(np.sum(c_alpha, axis=0) > 0)[0]
                    c_rows = np.where(np.sum(c_alpha, axis=1) > 0)[0]
                    if len(c_cols) > 0 and len(c_rows) > 0:
                        cropped = cropped[c_rows[0]:c_rows[-1]+1, c_cols[0]:c_cols[-1]+1]
                        
                    out_path = img_path.replace(".png", f"_split_v_{i}.png")
                    cv2.imwrite(out_path, cropped)
        else:
            # Just trim and save
            c_cols = np.where(np.sum(alpha, axis=0) > 0)[0]
            c_rows = np.where(np.sum(alpha, axis=1) > 0)[0]
            if len(c_cols) > 0 and len(c_rows) > 0:
                cropped = img[c_rows[0]:c_rows[-1]+1, c_cols[0]:c_cols[-1]+1]
                out_path = img_path.replace(".png", f"_split_trimmed.png")
                cv2.imwrite(out_path, cropped)
    else:
        for i, (s, e) in enumerate(zip(starts, ends)):
            if e - s > 50: # valid width
                cropped = img[:, s:e]
                
                # further trim vertically
                c_alpha = cropped[:, :, 3]
                c_rows = np.where(np.sum(c_alpha, axis=1) > 0)[0]
                if len(c_rows) > 0:
                    cropped = cropped[c_rows[0]:c_rows[-1]+1, :]
                    
                out_path = img_path.replace(".png", f"_split_h_{i}.png")
                cv2.imwrite(out_path, cropped)

