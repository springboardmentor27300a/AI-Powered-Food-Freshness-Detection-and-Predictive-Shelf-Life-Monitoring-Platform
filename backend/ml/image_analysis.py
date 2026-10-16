import cv2
import numpy as np

def analyze_image(image_bytes: bytes) -> dict:
    """
    OpenCV-based image analysis module using Localized Region Analysis.
    Calculates beginner-friendly visual heuristics directly from image pixels.
    This does NOT use any trained model. It relies purely on classical image processing.
    """
    
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Failed to decode image bytes with OpenCV.")

    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    total_pixels = image.shape[0] * image.shape[1]

    # Saturation threshold: food is saturated, white/gray/black backgrounds are not
    s_channel = image_hsv[:, :, 1]
    _, foreground_mask = cv2.threshold(s_channel, 20, 255, cv2.THRESH_BINARY)
    
    # If foreground detection fails (e.g., white food on white plate), fallback to whole image
    food_area = cv2.countNonZero(foreground_mask)
    if food_area < (total_pixels * 0.10):
        food_area = total_pixels
        foreground_mask = np.ones(s_channel.shape, dtype=np.uint8) * 255

    avg_color_per_row = np.average(image_rgb, axis=0)
    avg_color = np.average(avg_color_per_row, axis=0)
    
    lower_brown = np.array([10, 50, 20])
    upper_brown = np.array([20, 255, 200])
    brown_mask = cv2.inRange(image_hsv, lower_brown, upper_brown)
    brown_mask = cv2.bitwise_and(brown_mask, foreground_mask)
    brown_pixel_ratio = (cv2.countNonZero(brown_mask) / food_area) * 100

    lower_dark = np.array([0, 0, 0])
    upper_dark = np.array([180, 255, 50])
    dark_mask = cv2.inRange(image_hsv, lower_dark, upper_dark)
    dark_mask = cv2.bitwise_and(dark_mask, foreground_mask)
    dark_pixel_ratio = (cv2.countNonZero(dark_mask) / food_area) * 100

    color_analysis = {
        "average_rgb": {
            "red": round(avg_color[0], 1),
            "green": round(avg_color[1], 1),
            "blue": round(avg_color[2], 1)
        },
        "brown_pixel_ratio": round(brown_pixel_ratio, 2),
        "dark_pixel_ratio": round(dark_pixel_ratio, 2)
    }

    texture_variance = cv2.Laplacian(gray_image, cv2.CV_64F).var()
    
    edges = cv2.Canny(gray_image, 100, 200)
    edges = cv2.bitwise_and(edges, foreground_mask)
    edge_density = (cv2.countNonZero(edges) / food_area) * 100

    texture_analysis = {
        "texture_variance": round(texture_variance, 2),
        "edge_density": round(edge_density, 2),
        "surface_roughness": round(edge_density * 1.5, 2)
    }

    discoloration_ratio = brown_pixel_ratio + dark_pixel_ratio
    
    degradation_analysis = {
        "discoloration_ratio": round(discoloration_ratio, 2),
        "dark_region_ratio": round(dark_pixel_ratio, 2),
        "surface_irregularity": round(texture_variance / 100, 2)
    }

    def get_max_region_ratio(mask):
        """Finds the largest connected component in the mask relative to the food area."""
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        max_area = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > max_area:
                max_area = area
        return (max_area / food_area) * 100

    max_brown_region_ratio = get_max_region_ratio(brown_mask)
    max_dark_region_ratio = get_max_region_ratio(dark_mask)

    lower_mold = np.array([0, 0, 180])
    upper_mold = np.array([180, 30, 255])
    mold_mask = cv2.inRange(image_hsv, lower_mold, upper_mold)
    mold_mask = cv2.bitwise_and(mold_mask, foreground_mask)
    max_mold_region_ratio = get_max_region_ratio(mold_mask)

    # Thresholds use localized region areas rather than global pixel counts (conservative)
    possible_bruising = max_brown_region_ratio > 3.0 or max_dark_region_ratio > 2.0
    possible_physical_damage = edge_density > 15.0 and texture_variance > 1500.0
    possible_mold_indicator = max_mold_region_ratio > 1.0

    damage_indicators = {
        "possible_bruising": bool(possible_bruising),
        "possible_physical_damage": bool(possible_physical_damage)
    }

    return {
        "color_analysis": color_analysis,
        "texture_analysis": texture_analysis,
        "degradation_analysis": degradation_analysis,
        "damage_indicators": damage_indicators,
        "possible_mold_indicator": bool(possible_mold_indicator),
        "disclaimer": "Basic visual heuristics only; no dedicated damage/mold detection model is trained."
    }
