import os

# Read files from app\ (not app\ml)\
files = [
    r'D:\infosys\project 1\backend\app\m3.py',
    r'D:\infosys\project 1\backend\app\schemas.py', 
    r'D:\infosys\project 1\backend\app\Models.py',  # case-sensitive
    r'D:\infosys\project 1\backend\app\auth.py',
    r'D:\infosys\project 1\backend\app\database.py',
    r'D:\infosys\project 1\backend\app\main.py',
    r'D:\infosys\project 1\backend\app\ml\rsl_predictor.py',
    r'D:\infosys\project 1\backend\app\ml\shelf_life.py',
    r'D:\infosys\project 1\backend\app\ml\train_m3_models.py',
    r'D:\infosys\project 1\backend\app\ml\datasets\processed\chicken_training.csv',
    r'D:\infosys\project 1\backend\app\ml\datasets\processed\paneer_training.csv',
    r'D:\infosys\project 1\backend\app\ml\datasets\processed\seafood_training.csv',
    r'D:\infosys\project 1\backend\app\ml\datasets\processed\tomato_training.csv',
    r'D:\infosys\project 1\backend\app\ml\saved_models\model_registry.json',
    r'D:\infosys\project 1\backend\freshness.db',
]

for f in files:
    if os.path.exists(f):
        print(f"\n=== {f} ===")
        try:
            with open(f, 'r', encoding='utf-8', errors='replace') as fh:
                content = fh.read()
                print(content[:2500])
        except Exception as e:
            print(f"  Error: {type(e).__name__}: {e}")
    else:
        print(f"\n=== {f}: NOT FOUND ===")