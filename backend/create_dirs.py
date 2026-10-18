import os
base = r'D:\infosys\project 1\backend\app\ml\data\raw'
for sub in ['tomato', 'paneer', 'seafood']:
    path = os.path.join(base, sub)
    os.makedirs(path, exist_ok=True)
    print(f'Created: {path}')
print('Done')
