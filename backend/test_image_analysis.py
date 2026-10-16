import os
import json
from ml.image_analysis import analyze_image

def main():
    test_image_path = os.path.join(os.path.dirname(__file__), "test_images", "fresh_apple.jpg")
    
    print(f"Testing OpenCV analysis with image: {test_image_path}")
    
    if not os.path.exists(test_image_path):
        print(f"Error: Could not find image at {test_image_path}")
        return

    with open(test_image_path, "rb") as f:
        image_bytes = f.read()
    
    print("\nExecuting analyze_image()...")
    
    try:
        result = analyze_image(image_bytes)
        
        print("\n--- ANALYSIS RESULT ---")
        print(json.dumps(result, indent=4))
        
    except Exception as e:
        print(f"Error during analysis: {e}")

if __name__ == "__main__":
    main()
