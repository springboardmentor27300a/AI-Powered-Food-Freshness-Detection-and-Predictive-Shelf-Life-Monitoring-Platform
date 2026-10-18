from __future__ import annotations

from typing import Any

from tensorflow.keras.layers import DepthwiseConv2D as KerasDepthwiseConv2D


class CompatDepthwiseConv2D(KerasDepthwiseConv2D):
    """Compatibility shim for older/newer Keras H5 files that include an
    unexpected `groups` keyword in DepthwiseConv2D configs.

    This shim is conservative: it simply removes `groups` from the config
    if present before delegating to the real Keras DepthwiseConv2D. Only use
    when `groups==1` (equivalent to a standard depthwise conv) — the loader
    that uses this shim should verify that `groups` is 1 where present.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        # Remove `groups` if present; depthwise conv semantics require
        # depth_multiplier instead. We only silently drop it here because
        # most exported models set groups=1 which is equivalent.
        if "groups" in kwargs:
            grp = kwargs.pop("groups")
            if grp != 1:
                raise ValueError("CompatDepthwiseConv2D only supports groups==1")
        super().__init__(*args, **kwargs)

    @classmethod
    def from_config(cls, config):
        cfg = dict(config)
        grp = cfg.pop("groups", None)
        if grp is not None and grp != 1:
            raise ValueError("CompatDepthwiseConv2D only supports groups==1")
        return KerasDepthwiseConv2D.from_config(cfg)
