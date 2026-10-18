import csv
for name in ['tomato_training.csv', 'paneer_training.csv', 'seafood_training.csv']:
    path = f'D:\\infosys\\project 1\\backend\\app\\ml\\datasets\\processed\\{name}'
    with open(path) as f:
        rows = sum(1 for _ in f) - 1
        print(f'{name}: {rows} rows')
