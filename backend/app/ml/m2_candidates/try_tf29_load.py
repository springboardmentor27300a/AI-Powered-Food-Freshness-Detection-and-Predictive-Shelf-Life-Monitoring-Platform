import numpy as np
from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'saved_models' / 'm2' / 'candidates' / 'captraj_fruitveg' / 'rottenvsfresh98pval.h5'
print('model path:', p)

import tensorflow as tf

class CompatDepthwiseConv2D(tf.keras.layers.DepthwiseConv2D):
    def __init__(self, *args, **kwargs):
        if 'groups' in kwargs:
            g = kwargs.pop('groups')
            if g != 1:
                raise ValueError(f'Unsupported groups={g}')
        super().__init__(*args, **kwargs)

    @classmethod
    def from_config(cls, config):
        cfg = dict(config)
        cfg.pop('groups', None)
        return tf.keras.layers.DepthwiseConv2D.from_config(cfg)

custom = {'DepthwiseConv2D': CompatDepthwiseConv2D}
model = tf.keras.models.load_model(str(p), compile=False, custom_objects=custom)
print('loaded ok')
print('input_shape=', model.input_shape)
print('output_shape=', model.output_shape)
img = np.zeros((1, 100, 100, 3), dtype=np.float32)
out = model.predict(img, verbose=0)
print('predict shape=', out.shape)
print('min/max/mean=', float(np.min(out)), float(np.max(out)), float(np.mean(out)))
