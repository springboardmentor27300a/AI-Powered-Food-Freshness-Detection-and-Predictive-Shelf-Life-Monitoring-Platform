import h5py, json
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'saved_models' / 'm2' / 'candidates' / 'captraj_fruitveg' / 'rottenvsfresh98pval.h5'
print('path:', p)
with h5py.File(p,'r') as f:
    print('Top keys:', list(f.keys()))
    print('Attrs:', list(f.attrs.keys()))
    cfg = f.attrs.get('model_config')
    if cfg is not None:
        s = cfg.decode() if isinstance(cfg, bytes) else cfg
        try:
            j = json.loads(s)
            print('Model class_name:', j.get('class_name'))
            cfg = j.get('config')
            if isinstance(cfg, dict):
                print('Config keys top level:', list(cfg.keys())[:20])
                # If this is a Sequential/Functional model, inspect layers
                layers = cfg.get('layers') or cfg.get('layer') or []
                print('Layer count:', len(layers))
                for i, L in enumerate(layers[:12]):
                    name = L.get('class_name') or L.get('class') or '<unknown>'
                    print(f"Layer {i}: class={name} keys={list(L.keys())[:10]}")
                    # detect InputLayer shapes
                    if name in ('InputLayer', 'Input'):
                        print('  Input config:', L.get('config'))
        except Exception as e:
            print('model_config parse error', e)
    else:
        print('No model_config attr; try checking model_weights group')
    if 'model_weights' in f:
        print('model_weights groups (first 20):', list(f['model_weights'].keys())[:20])
    # try to print 'input_1' group if exists
    for k in list(f.keys()):
        print(k, type(f[k]))
print('done')
